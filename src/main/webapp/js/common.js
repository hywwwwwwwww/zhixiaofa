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

  /** 退出登录 */
  ZF.logout = function () {
    return ZF.post('/auth/logout', null, { silent: true }).then(function () {
      ZF.clearUserCache();
      window.location.href = CTX + '/login.html';
    });
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

  /** 截断文本 */
  ZF.truncate = function (text, len) {
    if (!text) {
      return '';
    }
    var s = String(text);
    return s.length > len ? s.substring(0, len) + '…' : s;
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

  window.ZF = ZF;
})(window, jQuery);
