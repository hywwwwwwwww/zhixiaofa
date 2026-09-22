/**
 * @file common.js —— 职小法前端公共库
 * @description 基于 jQuery 封装统一 AJAX、登录态、提示、分页与格式化工具。
 *              所有页面只依赖本文件暴露的 window.ZF 命名空间，避免各页面重复造轮子。
 * @author 职小法小组
 * @version 1.0
 */

/* global jQuery */
(function (window, $) {
  'use strict';

  /** 应用上下文路径（部署在 /zhixiaofa 下） */
  var CTX = (function () {
    var path = window.location.pathname;
    var idx = path.indexOf('/pages/');
    if (idx > 0) {
      return path.substring(0, idx);
    }
    idx = path.indexOf('/admin/');
    if (idx > 0) {
      return path.substring(0, idx);
    }
    return path.replace(/\/[^/]*$/, '');
  })();

  /** 后端接口根地址 */
  var API_BASE = CTX + '/api';

  /** 统一响应成功码 */
  var CODE_SUCCESS = 10000;
  /** 未登录错误码 */
  var CODE_UNAUTHORIZED = 11301;

  var ZF = {};

  ZF.CTX = CTX;
  ZF.API_BASE = API_BASE;

  /* ==================================================================
   *  AJAX 封装
   * ================================================================== */

  /**
   * 发送 AJAX 请求。
   *
   * 约定：后端所有接口都返回 { code, message, data }，
   * code === 10000 视为成功，其余情况自动弹出错误提示。
   *
   * @param {string} url    相对 API_BASE 的路径，如 '/qa'
   * @param {string} method HTTP 方法
   * @param {Object} [data] 请求体（自动 JSON 序列化）
   * @param {Object} [opts] 可选项 { silent: 不弹错误提示, loading: 显示加载遮罩 }
   * @returns {Promise<Object>} resolve(后端 data 字段)，失败直接 reject，业务层只需处理成功分支
   */
  ZF.request = function (url, method, data, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      var settings = {
        url: API_BASE + url,
        type: method || 'GET',
        dataType: 'json',
        xhrFields: { withCredentials: true }
      };
      if (data !== undefined && data !== null && method !== 'GET') {
        settings.contentType = 'application/json;charset=UTF-8';
        settings.data = JSON.stringify(data);
      } else if (data && method === 'GET') {
        settings.data = data;
      }
      if (opts.loading !== false) {
        $('body').css('cursor', 'progress');
      }
      settings.complete = function () {
        $('body').css('cursor', '');
      };
      settings.success = function (res) {
        if (res && res.code === CODE_SUCCESS) {
          resolve(res.data);
          return;
        }
        var msg = (res && res.message) || '请求失败';
        if (res && res.code === CODE_UNAUTHORIZED) {
          ZF.toast('登录已失效，请重新登录', 'warn');
          setTimeout(function () { ZF.redirectLogin(); }, 900);
          reject(res);
          return;
        }
        if (!opts.silent) {
          ZF.toast(msg, 'error');
        }
        reject(res || { code: -1, message: msg });
      };
      settings.error = function (xhr) {
        var msg = '网络异常，请稍后重试';
        if (xhr && xhr.responseJSON && xhr.responseJSON.message) {
          msg = xhr.responseJSON.message;
        } else if (xhr && xhr.status === 401) {
          msg = '请先登录';
          setTimeout(function () { ZF.redirectLogin(); }, 900);
        }
        if (!opts.silent) {
          ZF.toast(msg, 'error');
        }
        reject({ code: xhr && xhr.status, message: msg });
      };
      $.ajax(settings);
    });
  };

  /** GET 请求 */
  ZF.get = function (url, params, opts) {
    return ZF.request(url, 'GET', params, opts);
  };
  /** POST 请求 */
  ZF.post = function (url, data, opts) {
    return ZF.request(url, 'POST', data, opts);
  };
  /** PUT 请求 */
  ZF.put = function (url, data, opts) {
    return ZF.request(url, 'PUT', data, opts);
  };
  /** DELETE 请求 */
  ZF.del = function (url, params, opts) {
    return ZF.request(url, 'DELETE', params, opts);
  };

  /* ==================================================================
   *  登录态
   * ================================================================== */

  /** 缓存当前登录用户，避免每个页面重复请求 */
  var currentUser = null;

  /**
   * 获取当前登录用户（带缓存）。
   * @returns {Promise<Object|null>} 未登录时 resolve(null)
   */
  ZF.currentUser = function () {
    if (currentUser) {
      return Promise.resolve(currentUser);
    }
    return ZF.get('/auth/me', null, { silent: true }).then(function (user) {
      currentUser = user;
      return user;
    }).catch(function () {
      return null;
    });
  };

  /** 清空用户缓存（资料修改后调用） */
  ZF.clearUserCache = function () {
    currentUser = null;
  };

  /**
   * 页面级登录校验：未登录跳转到登录页。
   * @param {boolean} [needAdmin] 是否要求管理员身份
   * @returns {Promise<Object>} 登录用户
   */
  ZF.requireLogin = function (needAdmin) {
    return ZF.currentUser().then(function (user) {
      if (!user) {
        ZF.setRedirect();
        window.location.href = CTX + '/login.html';
        return Promise.reject('unauthenticated');
      }
      if (needAdmin && user.role !== 'ADMIN') {
        ZF.toast('该页面仅管理员可访问', 'error');
        setTimeout(function () { window.location.href = CTX + '/pages/home.html'; }, 1000);
        return Promise.reject('forbidden');
      }
      return user;
    });
  };

  /**
   * 退出登录。
   *
   * @param {string} [confirmText] 传入时先弹二次确认，用户取消则不退出。
   *        管理端的「换账号登录」按钮会传入自定义文案（见 admin-common.js）。
   * @returns {Promise|undefined} 未传确认文案时返回请求 Promise；传了则返回确认链
   */
  ZF.logout = function (confirmText) {
    function doLogout() {
      return ZF.post('/auth/logout', null, { silent: true }).then(function () {
        ZF.clearUserCache();
        window.location.href = CTX + '/login.html';
      });
    }
    if (confirmText) {
      return ZF.confirm(confirmText).then(function (ok) {
        if (ok) {
          return doLogout();
        }
      });
    }
    return doLogout();
  };

  /** 记录来源页，登录后跳回 */
  ZF.setRedirect = function () {
    try {
      window.sessionStorage.setItem('zf_redirect', window.location.href);
    } catch (e) {
      // 隐私模式下 sessionStorage 不可用，忽略
    }
  };

  /** 登录成功后跳回来源页或默认首页 */
  ZF.redirectLogin = function () {
    var target = null;
    try {
      target = window.sessionStorage.getItem('zf_redirect');
      if (target) {
        window.sessionStorage.removeItem('zf_redirect');
      }
    } catch (e) {
      target = null;
    }
    window.location.href = target || (CTX + '/login.html');
  };

  /* ==================================================================
   *  UI 组件
   * ================================================================== */

  /**
   * 顶部轻提示。
   * @param {string} message 提示文案
   * @param {string} [type]  success | error | warn | info
   * @param {number} [duration] 停留毫秒数
   */
  ZF.toast = function (message, type, duration) {
    type = type || 'info';
    duration = duration || 2600;
    var $wrap = $('.zf-toast-wrap');
    if (!$wrap.length) {
      $wrap = $('<div class="zf-toast-wrap"></div>').appendTo('body');
    }
    var icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', warn: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
    var $el = $('<div class="zf-toast zf-toast--' + type + '">' +
      '<i class="bi ' + (icons[type] || icons.info) + '"></i><span></span></div>');
    $el.find('span').text(message);
    $wrap.append($el);
    setTimeout(function () {
      $el.fadeOut(220, function () { $el.remove(); });
    }, duration);
  };

  /**
   * 二次确认。
   * @param {string} message 确认文案
   * @returns {Promise<boolean>}
   */
  ZF.confirm = function (message) {
    return new Promise(function (resolve) {
      if (window.confirm(message)) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  };

  /** HTML 转义，所有来自后端的文本都要过一遍再拼进 DOM，防 XSS */
  ZF.escape = function (text) {
    if (text === null || text === undefined) {
      return '';
    }
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /** 把换行转成 <br>，用于展示多行回答（先转义再替换） */
  ZF.nl2br = function (text) {
    return ZF.escape(text).replace(/\n/g, '<br>');
  };

  /**
   * 截断文本。
   * 【重要】纯文本场景可直接使用；但**要插入 HTML 时必须先 ZF.escape 再截断**，
   * 否则会把 `&amp;` 之类的实体从中间切断（如 escape('A & B') = 'A &amp; B'，
   * 截 8 字 → 'A &amp; …'），反向断出一个非法实体被浏览器渲染成乱码。
   * @param {string} text 原文
   * @param {number} len 保留字符数
   */
  ZF.truncate = function (text, len) {
    if (!text) {
      return '';
    }
    var s = String(text);
    return s.length > len ? s.substring(0, len) + '…' : s;
  };

  /**
   * 复制文本到剪贴板（优先使用 Clipboard API，不可用时退回 execCommand）。
   * @param {string} text 待复制文本
   * @param {string} [successText] 成功后的提示文案，默认「已复制」
   */
  ZF.copyText = function (text, successText) {
    var onOk = function () { ZF.toast(successText || '已复制', 'success'); };
    var onFail = function () { ZF.toast('复制失败，请手动选择文本', 'error'); };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text == null ? '' : String(text);
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        if (document.execCommand('copy')) { onOk(); } else { onFail(); }
      } catch (e) {
        onFail();
      }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text == null ? '' : String(text)).then(onOk).catch(fallback);
    } else {
      fallback();
    }
  };

  /**
   * 日期时间格式化：把后端的 'yyyy-MM-dd HH:mm:ss' 转成可读展示。
   * @param {string} value 时间字符串
   * @param {boolean} [withTime] 是否保留时分
   */
  ZF.formatDate = function (value, withTime) {
    if (!value) {
      return '';
    }
    var s = String(value).replace('T', ' ');
    return withTime === false ? s.substring(0, 10) : s.substring(0, 16);
  };

  /** 金额千分位 */
  ZF.money = function (value) {
    if (value === null || value === undefined || value === '') {
      return '0';
    }
    var n = Number(value);
    if (isNaN(n)) {
      return String(value);
    }
    return n.toFixed(n % 1 === 0 ? 0 : 2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  /**
   * 渲染分页控件。
   * @param {jQuery|string} container 容器
   * @param {Object} page { pageNum, pageSize, total, pages }
   * @param {Function} onChange 点击页码的回调，参数为新的 pageNum
   */
  ZF.renderPager = function (container, page, onChange) {
    var $c = $(container);
    var pages = page.pages || 0;
    var current = page.pageNum || 1;
    if (pages <= 0) {
      $c.empty();
      return;
    }
    var html = ['<div class="zf-pager">'];
    html.push('<span class="zf-pager__info">共 ' + page.total + ' 条，第 ' + current + ' / ' + pages + ' 页</span>');
    html.push('<button class="zf-pager__btn" data-page="' + (current - 1) + '"' + (current <= 1 ? ' disabled' : '') + '>上一页</button>');

    var start = Math.max(1, current - 2);
    var end = Math.min(pages, start + 4);
    start = Math.max(1, end - 4);
    for (var i = start; i <= end; i++) {
      html.push('<button class="zf-pager__btn' + (i === current ? ' zf-pager__btn--active' : '') +
        '" data-page="' + i + '">' + i + '</button>');
    }
    html.push('<button class="zf-pager__btn" data-page="' + (current + 1) + '"' + (current >= pages ? ' disabled' : '') + '>下一页</button>');
    html.push('</div>');
    $c.html(html.join(''));

    $c.off('click.zfpager').on('click.zfpager', '.zf-pager__btn', function () {
      var target = parseInt($(this).data('page'), 10);
      if (!$(this).prop('disabled') && target >= 1 && target <= pages && target !== current) {
        onChange(target);
      }
    });
  };

  /** 渲染空态 */
  ZF.renderEmpty = function (container, text) {
    $(container).html('<div class="zf-empty"><i class="bi bi-inbox zf-empty__icon"></i>' +
      ZF.escape(text || '暂无数据') + '</div>');
  };

  /** 渲染加载中 */
  ZF.renderLoading = function (container, text) {
    $(container).html('<div class="zf-loading"><span class="spinner-border spinner-border-sm"></span> ' +
      ZF.escape(text || '加载中…') + '</div>');
  };

  /* ==================================================================
   *  锚点定位（指标卡跳转到页面具体区块）
   * ================================================================== */

  /**
   * 平滑滚动到指定锚点元素，并短暂高亮目标区块。
   * @param {string} [hash] 锚点（含或不含 #），缺省取地址栏 hash
   * @param {Object} [opts] { offset: 顶部固定栏预留高度，默认 74 }
   * @returns {boolean} 是否找到目标元素
   */
  ZF.scrollToAnchor = function (hash, opts) {
    opts = opts || {};
    var id = String(hash || window.location.hash || '').replace(/^#/, '');
    if (!id) {
      return false;
    }
    var el = document.getElementById(id);
    if (!el) {
      return false;
    }
    var offset = opts.offset === undefined ? 74 : opts.offset;
    var top = el.getBoundingClientRect().top +
      (window.pageYOffset || document.documentElement.scrollTop) - offset;
    window.scrollTo({ top: top > 0 ? top : 0, behavior: 'smooth' });
    // 重放高亮动画：先移除并强制重排，避免连续点击时动画不触发
    el.classList.remove('zf-anchor-flash');
    void el.offsetWidth;
    el.classList.add('zf-anchor-flash');
    window.setTimeout(function () { el.classList.remove('zf-anchor-flash'); }, 1600);
    return true;
  };

  /**
   * 页面初始化完成后处理地址栏锚点。
   * 需在异步数据渲染完成后再调用，否则页面高度变化会导致定位偏移。
   * @param {Object} [opts] 透传给 ZF.scrollToAnchor
   */
  ZF.handleHashAnchor = function (opts) {
    if (!window.location.hash) {
      return;
    }
    // 等待一帧，确保列表渲染后的高度已生效
    window.setTimeout(function () { ZF.scrollToAnchor(null, opts); }, 60);
  };

  /**
   * 让容器内的站内锚点链接（如指标卡跳本页收藏区）平滑滚动而非瞬间跳转。
   * @param {jQuery|string} container 事件委托的容器，缺省为 document
   */
  ZF.bindAnchorLinks = function (container) {
    $(container || document).on('click.zfanchor', 'a[href^="#"]', function (e) {
      var hash = $(this).attr('href');
      if (hash.length < 2) {
        return;
      }
      if (ZF.scrollToAnchor(hash)) {
        e.preventDefault();
        // 同步地址栏，便于刷新后仍停留在该区块
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', hash);
        }
      }
    });
  };

  /** 风险等级 → 徽标样式 */
  ZF.riskBadge = function (level) {
    var map = { '高': 'high', '中': 'mid', '低': 'low' };
    var cls = map[level] || 'primary';
    return '<span class="zf-badge zf-badge--' + cls + '">' + ZF.escape(level || '未知') + '风险</span>';
  };

  /**
   * 轻量表单校验。
   * @param {jQuery} $form 表单 jQuery 对象
   * @param {Object} rules 规则 { 字段id: { required, min, max, pattern, message } }
   * @returns {boolean} 是否全部通过
   */
  ZF.validate = function ($form, rules) {
    var ok = true;
    Object.keys(rules).forEach(function (name) {
      var rule = rules[name];
      var $input = $form.find('[name="' + name + '"]');
      var $field = $input.closest('.zf-field');
      var value = $.trim($input.val() || '');
      var error = '';

      if (rule.required && !value) {
        error = rule.message || '该项不能为空';
      } else if (value && rule.min && value.length < rule.min) {
        error = '长度不能少于 ' + rule.min + ' 位';
      } else if (value && rule.max && value.length > rule.max) {
        error = '长度不能超过 ' + rule.max + ' 位';
      } else if (value && rule.pattern && !rule.pattern.test(value)) {
        error = rule.message || '格式不正确';
      }

      $field.toggleClass('zf-field--invalid', !!error);
      if (error) {
        $field.find('.zf-form-error').text(error);
        ok = false;
      }
    });
    return ok;
  };

  /** 清空表单校验状态 */
  ZF.clearValidate = function ($form) {
    $form.find('.zf-field--invalid').removeClass('zf-field--invalid');
  };

  /* ==================================================================
   *  侧边栏渲染（所有内页共用）
   * ================================================================== */

  /** 导航配置 */
  var NAV = [
    { key: 'home', text: '首页', icon: 'bi-house', href: '/pages/home.html' },
    { key: 'qa', text: '智能法律问答', icon: 'bi-chat-square-text', href: '/pages/qa.html' },
    { key: 'court', text: 'AI小法庭', icon: 'bi-bank', href: '/pages/court.html' },
    { key: 'contract', text: '合同智能审查', icon: 'bi-file-earmark-check', href: '/pages/contract-review.html' },
    { key: 'doc', text: '法律文书起草', icon: 'bi-pencil-square', href: '/pages/doc-drafting.html' },
    { key: 'knowledge', text: '普法知识广场', icon: 'bi-journal-text', href: '/pages/knowledge.html' },
    { key: 'profile', text: '个人中心', icon: 'bi-person-circle', href: '/pages/profile.html' }
  ];

  /**
   * 渲染共享侧边栏。
   * @param {string} activeKey 当前高亮的导航 key
   * @param {Object} [user] 当前用户，传入后底部显示管理员入口
   */
  ZF.renderSidebar = function (activeKey, user) {
    if ($('.zf-sidebar').length) {
      return;
    }
    var html = ['<aside class="zf-sidebar">'];
    html.push('<div class="zf-sidebar__brand">');
    html.push('<div class="zf-sidebar__mark">职法</div>');
    html.push('<div><h1 class="zf-sidebar__name">职小法</h1>');
    html.push('<p class="zf-sidebar__slogan">职场新人的智能法律伙伴</p></div></div>');
    html.push('<div class="zf-sidebar__label">功能导航</div>');
    html.push('<nav class="zf-sidebar__nav">');
    NAV.forEach(function (item) {
      html.push('<a class="zf-nav' + (item.key === activeKey ? ' zf-nav--active' : '') +
        '" href="' + CTX + item.href + '"><i class="bi ' + item.icon + ' zf-nav__icon"></i>' +
        ZF.escape(item.text) + '</a>');
    });
    if (user && user.role === 'ADMIN') {
      html.push('<a class="zf-nav" href="' + CTX + '/admin/index.html">' +
        '<i class="bi bi-speedometer2 zf-nav__icon"></i>后台管理</a>');
    }
    html.push('</nav>');
    html.push('<div class="zf-sidebar__foot">为职场新人提供基于法规库的智能法律服务<br>课程设计 · DAO-Service-Servlet 分层架构</div>');
    html.push('</aside>');
    $('.zf-app').prepend(html.join(''));
  };

  /**
   * 渲染顶部栏（标题 + 用户区 + 退出）。
   * @param {Object} conf { title, sub }
   * @param {Object} user 当前登录用户
   */
  ZF.renderTopbar = function (conf, user) {
    var $top = $('.zf-topbar');
    if (!$top.length) {
      return;
    }
    $top.html(
      '<div><h2 class="zf-topbar__title">' + ZF.escape(conf.title || '') + '</h2>' +
      (conf.sub ? '<p class="zf-topbar__sub">' + ZF.escape(conf.sub) + '</p>' : '') + '</div>' +
      '<div class="zf-topbar__spacer"></div>' +
      '<div class="zf-topbar__user">' +
      '<i class="bi bi-person-circle"></i>' +
      '<span>' + ZF.escape(user ? (user.nickname || user.username) : '') + '</span>' +
      (user && user.role === 'ADMIN' ? '<span class="zf-badge zf-badge--primary">管理员</span>' : '') +
      '</div>' +
      '<button class="zf-btn zf-btn--ghost zf-btn--sm" id="zf-logout">' +
      '<i class="bi bi-box-arrow-right"></i>退出</button>'
    );
    $top.off('click.zflogout').on('click.zflogout', '#zf-logout', function () {
      ZF.logout();
    });
  };

  /**
   * 内页初始化：校验登录 → 渲染侧边栏与顶栏。
   * @param {Object} conf { active: 导航key, title, sub, needAdmin }
   * @returns {Promise<Object>} 当前用户
   */
  ZF.initPage = function (conf) {
    return ZF.requireLogin(conf.needAdmin).then(function (user) {
      ZF.renderSidebar(conf.active, user);
      ZF.renderTopbar({ title: conf.title, sub: conf.sub }, user);
      return user;
    });
  };

  /**
   * 绑定「回车提交」与「按钮 loading」等通用交互。
   * @param {jQuery} $btn 按钮
   * @param {boolean} loading 是否进入加载态
   * @param {string} [text] 加载态文案
   */
  ZF.btnLoading = function ($btn, loading, text) {
    if (loading) {
      $btn.data('origin', $btn.html()).prop('disabled', true)
        .html('<span class="spinner-border spinner-border-sm"></span>' + (text || '处理中…'));
    } else {
      $btn.prop('disabled', false).html($btn.data('origin') || $btn.html());
    }
  };

  /* ==================================================================
   *  Tab 分段控件（视同组互斥内容切换，用于工作台左栏「填写 / 记录」）
   *  不依赖 Bootstrap 的 data-bs-toggle，避免与其 JS bundle 行为耦合
   * ================================================================== */

  /**
   * 初始化一个 Tab 组：代理点击与键盘，同步 aria 与面板显隐。
   *
   * <p>面板的查找范围由 tablist 最近的 [data-panel-scope] 祖先决定，
   * 因此面板必须与该容器同层；未找到时回退到 tablist 的父级。</p>
   *
   * @param {jQuery|string|Element} rootEl tablist 容器（.zf-tabs）
   * @param {Object} [options] 配置
   *        {string}   [value]     初始选中项（data-name 或元素 id），缺省取 aria-selected=true 的项
   *        {boolean}  [preserve]  是否保留面板 DOM，默认 true（仅切显隐）
   *        {Function} [onChange]  切换回调 function (name, prevName)
   * @returns {Object|null} { select, getValue, destroy }，容器不存在时返回 null
   */
  ZF.tabs = function (rootEl, options) {
    var opts = options || {};
    var $root = $(rootEl);
    if (!$root.length) {
      return null;
    }
    var ns = '.zftabs';
    var $scope = $root.closest('[data-panel-scope]');
    var $panelHost = $scope.length ? $scope : $root.parent();
    var $tabs = $root.find('.zf-tabs__tab');
    var preserve = opts.preserve !== false;
    var current = null;

    /** 取某个 tab 对应的面板元素 */
    function panelOf($tab) {
      var id = $tab.attr('aria-controls');
      return id ? $panelHost.find('#' + id) : $();
    }

    /** tab 的名称：优先 data-name，退化到元素 id */
    function nameOf($tab) {
      return $tab.data('name') || $tab[0].id;
    }

    /** 可用（未禁用）的 tab，键盘游走时跳过禁用项 */
    function enabledTabs() {
      return $tabs.filter(function () {
        return !(this.disabled || $(this).attr('aria-disabled') === 'true');
      });
    }

    /**
     * 选中指定名称的 tab。
     * @param {string} name tab 的 data-name 或 id
     * @param {boolean} [focus] 是否把焦点移到该 tab（键盘操作为 true）
     */
    function select(name, focus) {
      var $tab = $tabs.filter(function () { return nameOf($(this)) === name; }).first();
      if (!$tab.length || $tab.prop('disabled')) {
        return;
      }
      if (name === current) {
        if (focus) { $tab.trigger('focus'); }
        return;
      }
      var prev = current;
      $tabs.each(function () {
        var $t = $(this);
        var isOn = $t[0] === $tab[0];
        $t.toggleClass('zf-tabs__tab--active', isOn).attr('aria-selected', isOn ? 'true' : 'false');
        // roving tabindex：整组只留一个可 Tab 停留的项
        $t.attr('tabindex', isOn ? '0' : '-1');
        var $p = panelOf($t);
        if (!$p.length) {
          return;
        }
        $p.toggleClass('zf-tabs__panel--active', isOn);
        $p.prop('hidden', !isOn);
        if (!preserve && !isOn) {
          $p.empty();
        }
      });
      current = name;
      if (focus) { $tab.trigger('focus'); }
      if (typeof opts.onChange === 'function') {
        opts.onChange(name, prev);
      }
    }

    // 点击：事件委托，避免逐个绑定
    $root.off('click' + ns, '.zf-tabs__tab').on('click' + ns, '.zf-tabs__tab', function () {
      select(nameOf($(this)), false);
    });

    // 键盘：←/→/↑/↓ 与 Home/End 走 roving 焦点；Enter/Space 由 button 原生触发 click
    $root.off('keydown' + ns, '.zf-tabs__tab').on('keydown' + ns, '.zf-tabs__tab', function (e) {
      var key = e.key || e.which;
      var list = enabledTabs();
      var idx = list.index(this);
      var next = null;
      if (key === 'ArrowRight' || key === 39 || key === 'ArrowDown' || key === 40) {
        next = list.eq((idx + 1) % list.length);
      } else if (key === 'ArrowLeft' || key === 37 || key === 'ArrowUp' || key === 38) {
        next = list.eq((idx + list.length - 1) % list.length);
      } else if (key === 'Home' || key === 36) {
        next = list.first();
      } else if (key === 'End' || key === 35) {
        next = list.last();
      } else {
        return;
      }
      e.preventDefault();
      if (next && next.length) {
        // 项数少时「聚焦即选中」比「聚焦后按 Enter」少一步
        select(nameOf(next), true);
      }
    });

    var initial = opts.value;
    if (!initial) {
      var $on = $tabs.filter('[aria-selected="true"]').first();
      initial = $on.length ? nameOf($on) : null;
    }
    if (!initial && $tabs.length) {
      initial = nameOf($tabs.first());
    }
    if (initial) {
      select(initial, false);
    } else {
      $tabs.attr('tabindex', '-1');
      $tabs.first().attr('tabindex', '0');
    }

    return {
      select: function (name) { select(name, false); },
      getValue: function () { return current; },
      destroy: function () { $root.off(ns); }
    };
  };

  /**
   * 更新 Tab 上的计数徽标（工作台记录数量）。
   * @param {jQuery|string} $tab 目标 tab 元素
   * @param {number} count 数量，非正数时隐藏徽标
   */
  ZF.tabCount = function ($tab, count) {
    var $badge = $($tab).find('.zf-tabs__count');
    var n = Number(count) || 0;
    if (n > 0) {
      $badge.text(n).removeAttr('hidden');
    } else {
      $badge.text('').attr('hidden', 'hidden');
    }
  };

  /* ==================================================================
   *  空值占位与日期封装
   *  管理端表格里后端字段常为空，统一用 '-' 占位，避免出现「undefined」。
   * ================================================================== */

  /**
   * 空值占位：undefined / null / '' 一律返回 '-'，其余原样返回。
   * 注意本函数**只做占位、不做转义**，拼 HTML 时请外面再套 ZF.escape。
   *
   * @param {*} v 待判断的值
   * @returns {*} 原值或 '-'
   */
  ZF.orDash = function (v) {
    return (v === undefined || v === null || v === '') ? '-' : v;
  };

  /**
   * 日期格式化封装（仅日期，不含时分）。
   * @param {*} v 时间戳 / 日期串
   * @returns {string} 形如 2026-09-21，无法解析时为 '-'
   */
  ZF.dtDate = function (v) {
    return ZF.formatDate(v === undefined || v === null ? '' : v, false) || '-';
  };

  /* ==================================================================
   *  分类候选（管理端下拉共用）
   *  统一由常量提供候选，避免各页手输产生杂乱分类。
   * ================================================================== */

  /** 职场法律分类（文章 / 法律共用，与法条库语义保持一致） */
  ZF.WORK_CATEGORIES = ['劳动合同', '劳动报酬', '工作时间与休息休假', '社会保险', '解除与终止', '保密与竞业限制', '其他'];

  /** 题库分类：职场分类之外还按「试用期」单独成类 */
  ZF.QUIZ_CATEGORIES = ZF.WORK_CATEGORIES.concat(['试用期']);

  /**
   * 文书模板分类。注意它与职场分类**不是同一维度** ——
   * 模板是按文书性质划分的（函件 / 申请 / 通知 / 仲裁），不是按法律领域。
   */
  ZF.TEMPLATE_CATEGORIES = ['函件', '申请', '通知', '仲裁', '协议', '其他'];

  /**
   * 生成分类下拉的 <option> 串。
   *
   * @param {Array<string>} options  分类候选
   * @param {string} [allLabel]      非空时在最前面加一个空值选项（筛选栏用，如「全部分类」）；
   *                                 表单里不传，避免出现「空分类」
   * @param {Array<string>} [extra]  需要额外补进来的历史值（老数据里的分类，
   *                                 避免编辑时丢失或筛不到）
   * @returns {string} option HTML
   */
  ZF.categoryOptions = function (options, allLabel, extra) {
    var all = (options || []).slice();
    (extra || []).forEach(function (c) {
      if (c && all.indexOf(c) < 0) {
        all.push(c);
      }
    });
    var html = allLabel ? '<option value="">' + ZF.escape(allLabel) + '</option>' : '';
    all.forEach(function (c) {
      html += '<option value="' + ZF.escape(c) + '">' + ZF.escape(c) + '</option>';
    });
    return html;
  };

  /* ==================================================================
   *  问答状态徽标
   * ================================================================== */

  /** 问答状态：1=已回答 / 0=待回答 */
  ZF.qaStatusBadge = function (status) {
    return (status === 1 || status === '1')
      ? '<span class="zf-badge zf-badge--ok">已回答</span>'
      : '<span class="zf-badge zf-badge--mid">待回答</span>';
  };

  /* ==================================================================
   *  管理端筛选与详情弹窗
   * ================================================================== */

  /**
   * 读取筛选区里所有带 [data-filter] 的控件值，拼成查询参数。
   * 便于各管理页统一「筛选 → 刷新表格」的写法。
   *
   * @param {string} scope 筛选区选择器，如 '#user-filter'
   * @returns {Object} { 字段名: 值 }，空值会被过滤掉
   */
  ZF.filterParams = function (scope) {
    var out = {};
    $(scope).find('[data-filter]').each(function () {
      var v = $.trim($(this).val() || '');
      if (v !== '') {
        out[$(this).data('filter')] = v;
      }
    });
    return out;
  };

  /**
   * 打开一个只读的详情弹窗（复用 Bootstrap Modal，内容由调用方拼好）。
   *
   * @param {string} modalSelector 弹窗容器选择器（Bootstrap modal）
   * @param {string} title 弹窗标题
   * @param {string} bodyHtml 正文 HTML（调用方负责转义）
   */
  ZF.showDetailModal = function (modalSelector, title, bodyHtml) {
    var $m = $(modalSelector);
    $m.find('.modal-title').text(title || '详情');
    $m.find('.modal-body').html(bodyHtml || '');
    var inst = window.bootstrap && window.bootstrap.Modal.getInstance($m[0]);
    if (inst) {
      inst.show();
    } else if (window.bootstrap) {
      new window.bootstrap.Modal($m[0]).show();
    }
  };

  window.ZF = ZF;
})(window, jQuery);

  /* ==================================================================
   *  自定义下拉：优化原生 <select> 的观感
   *
   *  为什么需要：原生 select 展开后的弹层由浏览器/系统渲染 ——
   *  字体、内边距、选项高亮色（那块灰色）都无法用 CSS 控制。
   *  做法：**保留原生 select** 作为「数据源 + 取值 + change 事件」，
   *  仅把它视觉隐藏，在其位置渲染一套自定义的触发器与弹层。
   *  ⇒ 页面里既有的 `$sel.val()` / `.on('change')` / `ZF.filterParams()`
   *    一律无需修改；可访问性用 aria-haspopup/expanded/selected + 键盘操作保住。
   * ================================================================== */

  /** 已增强的下拉实例（用于互斥展开与标签同步） */
  var zfSelects = [];

  /** 关闭所有已展开的下拉 */
  function zfCloseAllSelects() {
    var i;
    for (i = 0; i < zfSelects.length; i++) {
      zfSelects[i].close();
    }
  }

  /** 增强单个原生 select */
  function zfEnhanceOne(el) {
    if (!el || el.__zfEnhanced) { return; }
    el.__zfEnhanced = true;

    var $el = $(el);
    var $wrap = $('<span class="zf-selectwrap"></span>');
    var $trig = $('<button type="button" class="zf-select" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="zf-select__value"></span>' +
      '<i class="bi bi-chevron-down zf-select__arrow" aria-hidden="true"></i></button>');
    var $menu = $('<div class="zf-select__menu" role="listbox"></div>');

    $el.addClass('zf-select__native');
    $el.after($wrap);
    $wrap.append($el).append($trig).append($menu);

    var rec = { el: el, $wrap: $wrap, $trig: $trig, $menu: $menu, lastText: null, active: -1 };

    /** 当前选中项文本 */
    rec.label = function () {
      var o = el.options[el.selectedIndex];
      return o ? $.trim($(o).text()) : '';
    };

    /** 同步触发器文本 —— 页面用 `$sel.val('')` 之类的赋值也能跟上 */
    rec.sync = function () {
      var t = rec.label();
      if (t !== rec.lastText) {
        rec.lastText = t;
        $trig.find('.zf-select__value').text(t || '全部');
        $trig.toggleClass('zf-select--unset', !t);
      }
    };

    /** 按当前 options 重建弹层（选项是异步填进去的，所以每次展开时重建） */
    rec.build = function () {
      var html = '';
      var i;
      for (i = 0; i < el.options.length; i++) {
        var o = el.options[i];
        var on = (i === el.selectedIndex);
        html += '<div class="zf-select__opt' + (on ? ' zf-select__opt--on' : '') + '"' +
          ' role="option" data-index="' + i + '" aria-selected="' + (on ? 'true' : 'false') + '">' +
          ZF.escape($(o).text()) + '</div>';
      }
      $menu.html(html);
      rec.active = el.selectedIndex;
      rec.mark();
    };

    /** 标记键盘高亮项 */
    rec.mark = function () {
      var $opts = $menu.children();
      $opts.removeClass('is-active');
      var $cur = $opts.eq(rec.active);
      $cur.addClass('is-active');
      if (rec.active >= 0 && $menu[0].scrollHeight > $menu[0].clientHeight) {
        var top = $cur[0].offsetTop;
        var h = $menu[0].clientHeight;
        if (top < $menu[0].scrollTop || top + 30 > $menu[0].scrollTop + h) {
          $menu[0].scrollTop = Math.max(0, top - h / 2);
        }
      }
    };

    rec.open = function () {
      if ($wrap.hasClass('zf-selectwrap--open')) { return; }
      zfCloseAllSelects();
      rec.build();
      $wrap.addClass('zf-selectwrap--open');
      $trig.attr('aria-expanded', 'true');
    };

    rec.close = function () {
      $wrap.removeClass('zf-selectwrap--open');
      $trig.attr('aria-expanded', 'false');
    };

    rec.toggle = function () {
      if ($wrap.hasClass('zf-selectwrap--open')) { rec.close(); } else { rec.open(); }
    };

    /** 选中第 i 项并通知原生 select */
    rec.pick = function (i) {
      var o = el.options[i];
      if (!o) { return; }
      if (i !== el.selectedIndex) {
        el.selectedIndex = i;
        rec.sync();
        $el.trigger('change');
      }
      rec.close();
      $trig.trigger('focus');
    };

    $trig.on('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      rec.toggle();
    });

    $trig.on('keydown', function (e) {
      var k = e.keyCode;
      var open = $wrap.hasClass('zf-selectwrap--open');
      if (!open && (k === 13 || k === 32 || k === 40 || k === 38)) {
        e.preventDefault(); rec.open(); return;
      }
      if (!open) { return; }
      if (k === 27) { e.preventDefault(); rec.close(); return; }
      if (k === 13 || k === 32) { e.preventDefault(); rec.pick(rec.active); return; }
      if (k === 40 || k === 38) {
        e.preventDefault();
        rec.active += (k === 40 ? 1 : -1);
        if (rec.active < 0) { rec.active = el.options.length - 1; }
        if (rec.active > el.options.length - 1) { rec.active = 0; }
        rec.mark();
      }
    });

    $menu.on('mousedown', '.zf-select__opt', function (e) {
      e.preventDefault();
      rec.pick(parseInt($(this).attr('data-index'), 10));
    });

    // 原生 select 自身变化（含 JS 触发）→ 同步文本
    $el.on('change', function () { rec.sync(); });

    rec.sync();
    zfSelects.push(rec);
  }

  /**
   * 增强作用域内的原生下拉。
   * @param {jQuery|string|Element} [root] 作用域，缺省为整个文档
   */
  ZF.enhanceSelect = function (root) {
    var $scope = root ? $(root) : $(document);
    $scope.find('select.zf-form-control').each(function () { zfEnhanceOne(this); });
  };

  // 互斥展开 + 点击空白关闭
  $(document).on('mousedown.zfselect', function (e) {
    if (!$(e.target).closest('.zf-selectwrap').length) { zfCloseAllSelects(); }
  });
  $(document).on('keydown.zfselect', function (e) {
    if (e.keyCode === 27) { zfCloseAllSelects(); }
  });

  // 页面用 `$sel.val('')` 直接改值时不会触发 change，这里轻量轮询兜底同步文本
  setInterval(function () {
    var i;
    for (i = 0; i < zfSelects.length; i++) {
      if (!zfSelects[i].el || !zfSelects[i].el.parentNode) { continue; }   // 已从 DOM 移除
      zfSelects[i].sync();
    }
  }, 400);
