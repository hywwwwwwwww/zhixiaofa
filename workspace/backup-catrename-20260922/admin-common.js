/**
 * @file admin-common.js —— 后台管理公共脚本
 * @description 后台页面共用的「管理端专用外壳」（左侧管理导航 + 顶部栏）、状态/角色/HTTP 方法徽标、
 *              统一的服务端分页表格初始化，以及 ECharts 实例的 resize 登记。
 *
 *              **本文件只提供管理功能，不含任何用户端能力**：左侧导航仅列出管理模块，
 *              不再渲染用户端的「首页 / 智能法律问答 / AI小法庭 / 合同审查 / 文书起草 /
 *              普法知识广场 / 个人中心」导航。
 *
 *              依赖 common.js（提供 window.ZF），须在其之后引入。
 * @author 职小法小组
 * @version 2.0
 */

/* global jQuery, echarts */
(function (window, $) {
  'use strict';

  var ZF = window.ZF;
  if (!ZF) {
    return; // common.js 未加载则直接退出，避免后续报错
  }

  /* ==================================================================
   *  管理端导航配置（仅管理功能）
   * ================================================================== */

  /**
   * 后台模块分组导航。key 用于当前页高亮；href 均为 admin/ 目录下的相对路径。
   * @type {Array<{group:string, items:Array<{key:string,text:string,icon:string,href:string}>}>}
   */
  ZF.ADMIN_NAV = [
    {
      group: '数据概览',
      items: [
        { key: 'dashboard', text: '数据看板', icon: 'bi-speedometer2', href: 'index.html' }
      ]
    },
    {
      group: '用户与内容',
      items: [
        { key: 'users', text: '用户管理', icon: 'bi-people', href: 'users.html' },
        { key: 'qa', text: '问答管理', icon: 'bi-chat-square-text', href: 'qa.html' },
        { key: 'contracts', text: '合同管理', icon: 'bi-file-earmark-check', href: 'contracts.html' },
        { key: 'laws', text: '法律管理', icon: 'bi-book', href: 'laws.html' },
        { key: 'knowledge', text: '文章管理', icon: 'bi-journal-text', href: 'knowledge.html' },
        { key: 'templates', text: '模板管理', icon: 'bi-layout-text-window', href: 'doc-templates.html' },
        { key: 'quiz', text: '题库管理', icon: 'bi-patch-question', href: 'quiz.html' }
      ]
    },
    {
      group: '系统运维',
      items: [
        { key: 'logs', text: '日志监控', icon: 'bi-activity', href: 'logs.html' }
      ]
    }
  ];

  /** 当前高亮 key，供后续扩展使用 */
  var activeKey = '';

  /**
   * 渲染管理端左侧导航（复用用户端的 .zf-sidebar / .zf-nav 样式，保持视觉一致）。
   *
   * @param {string} key  当前模块 key，用于高亮
   * @param {Object} user 当前登录管理员
   */
  ZF.renderAdminSidebar = function (key, user) {
    if ($('.zf-sidebar').length) {
      return; // 已渲染，避免重复插入
    }
    activeKey = key || '';

    var html = ['<aside class="zf-sidebar zf-admin-sidebar">'];
    html.push('<div class="zf-sidebar__brand">');
    html.push('<div class="zf-sidebar__mark">职法</div>');
    html.push('<div><h1 class="zf-sidebar__name">职小法 · 管理后台</h1>');
    html.push('<p class="zf-sidebar__slogan">内容与用户运营控制台</p></div></div>');

    ZF.ADMIN_NAV.forEach(function (group) {
      html.push('<div class="zf-sidebar__label">' + ZF.escape(group.group) + '</div>');
      html.push('<nav class="zf-sidebar__nav">');
      group.items.forEach(function (item) {
        var cls = 'zf-nav' + (item.key === activeKey ? ' zf-nav--active' : '');
        html.push('<a class="' + cls + '" href="' + ZF.escape(item.href) + '">' +
          '<i class="bi ' + item.icon + ' zf-nav__icon"></i>' + ZF.escape(item.text) + '</a>');
      });
      html.push('</nav>');
    });

    html.push('<div class="zf-sidebar__foot">');
    html.push('<div class="zf-admin-version">职小法管理后台 v2.0<br>课程设计 · DAO-Service-Servlet 分层架构</div>');
    html.push('</div>');
    html.push('</aside>');

    $('.zf-app').prepend(html.join(''));

    // 窄屏抽屉遮罩：点击遮罩关闭侧边栏
    if (!$('.zf-sidebar__scrim').length) {
      $('.zf-app').append('<div class="zf-sidebar__scrim"></div>');
    }
    bindSidebarToggle();
  };

  /**
   * 窄屏侧边栏抽屉：汉堡按钮切换，点遮罩 / 点导航项 / 按 Esc 关闭。
   *
   * <p>此前 ≤1100px 侧边栏被 CSS 直接隐藏且无替代入口，平板用户完全无法导航。</p>
   */
  function bindSidebarToggle() {
    var $sidebar = $('.zf-sidebar');
    var $scrim = $('.zf-sidebar__scrim');

    function close() {
      $sidebar.removeClass('zf-sidebar--open');
      $scrim.removeClass('zf-sidebar__scrim--show');
    }

    $(document).off('click.zfdrawer keydown.zfdrawer')
      .on('click.zfdrawer', '#zf-sidebar-toggle', function () {
        var open = $sidebar.toggleClass('zf-sidebar--open').hasClass('zf-sidebar--open');
        $scrim.toggleClass('zf-sidebar__scrim--show', open);
      })
      .on('click.zfdrawer', '.zf-sidebar__scrim', close)
      .on('click.zfdrawer', '.zf-sidebar .zf-nav', close)
      .on('keydown.zfdrawer', function (e) {
        if (e.key === 'Escape') {
          close();
        }
      });
  }

  /**
   * 渲染管理端顶部栏（页面标题 + 管理员身份 + 退出登录）。
   *
   * @param {Object} conf { title, sub }
   * @param {Object} user 当前登录管理员
   */
  ZF.renderAdminTopbar = function (conf, user) {
    var $top = $('.zf-topbar');
    if (!$top.length) {
      return;
    }
    conf = conf || {};
    var name = user ? (user.nickname || user.username) : '';
    $top.html(
      // 汉堡按钮：仅窄屏显示（CSS 控制），用于展开侧边栏抽屉
      '<button class="zf-topbar__menu" id="zf-sidebar-toggle" type="button" ' +
      'aria-label="展开导航" title="展开导航"><i class="bi bi-list"></i></button>' +
      '<div><h2 class="zf-topbar__title">' + ZF.escape(conf.title || '') + '</h2>' +
      (conf.sub ? '<p class="zf-topbar__sub">' + ZF.escape(conf.sub) + '</p>' : '') + '</div>' +
      '<div class="zf-topbar__spacer"></div>' +
      '<div class="zf-topbar__user">' +
      '<i class="bi bi-shield-lock"></i>' +
      '<span>' + ZF.escape(name) + '</span>' +
      '<span class="zf-badge zf-badge--primary">管理员</span>' +
      '</div>' +
      '<button class="zf-btn zf-btn--ghost zf-btn--sm" id="zf-admin-logout">' +
      '<i class="bi bi-box-arrow-right"></i>退出</button>'
    );
    $top.off('click.zfadminlogout').on('click.zfadminlogout', '#zf-admin-logout', function () {
      ZF.logout();
    });
  };

  /**
   * 渲染「无权限访问」提示：非管理员打开后台页面时显示。
   *
   * **刻意不跳转到用户端首页**：那样会让管理员/测试者看到用户端导航，
   * 误以为管理端里混进了用户功能。这里就在管理端内部给出明确提示。
   *
   * @param {Object} user 当前登录用户（可能为 null）
   */
  ZF.renderAdminDenied = function (user) {
    var name = user ? (user.nickname || user.username) : '';
    $('.zf-app').html(
      '<main class="zf-main" style="align-items:center;justify-content:center;display:flex">' +
      '<div class="zf-card zf-admin-denied">' +
      '<i class="bi bi-shield-exclamation"></i>' +
      '<h2>仅管理员可访问</h2>' +
      '<p>当前账号' + (name ? '「' + ZF.escape(name) + '」' : '') +
      '不是管理员，无法进入管理后台。</p>' +
      '<p class="zf-admin-denied__hint">如需管理权限，请让管理员在「用户管理」中把该账号设为管理员。</p>' +
      '<div class="zf-admin-denied__actions">' +
      '<button class="zf-btn zf-btn--primary" id="zf-denied-relogin">换账号登录</button>' +
      '</div></div></main>'
    );
    $(document).off('click.zfdenied').on('click.zfdenied', '#zf-denied-relogin', function () {
      ZF.logout('确定要退出当前账号，换一个账号登录吗？');
    });
  };

  /**
   * 后台页面统一入口：校验管理员身份 → 渲染管理端外壳。
   *
   * **注意：后台页面必须调用本方法，不要调用用户端的 ZF.initPage**，
   * 后者会渲染用户端导航，导致管理端混入用户功能。
   *
   * @param {Object} conf { active, title, sub }
   * @returns {Promise<Object>} 当前管理员（未登录/非管理员时 reject）
   */
  ZF.initAdminPage = function (conf) {
    conf = conf || {};
    return ZF.currentUser().then(function (user) {
      if (!user) {
        // 未登录 → 去登录页，登录后回到本页
        ZF.setRedirect();
        window.location.href = ZF.CTX + '/login.html';
        return Promise.reject('unauthenticated');
      }
      if (user.role !== 'ADMIN') {
        // 非管理员 → 在管理端内部给出提示，不跳转到用户端页面
        ZF.renderAdminDenied(user);
        return Promise.reject('forbidden');
      }
      ZF.renderAdminSidebar(conf.active, user);
      ZF.renderAdminTopbar({ title: conf.title, sub: conf.sub }, user);
      return user;
    });
  };

  /**
   * @deprecated 旧版横向 pill 导航，已由左侧管理导航取代。
   *             保留为空实现，避免历史页面调用时报错。
   */
  ZF.renderAdminNav = function () {
    /* 管理导航现由 ZF.renderAdminSidebar 统一渲染，此处不再输出任何内容 */
  };

  /* ==================================================================
   *  徽标助手
   * ================================================================== */

  /** 账号状态：1=启用 / 0=禁用 */
  ZF.statusBadge = function (status) {
    var on = (status === 1 || status === '1' || status === true);
    return on
      ? '<span class="zf-badge zf-badge--ok">已启用</span>'
      : '<span class="zf-badge zf-badge--mid">已禁用</span>';
  };

  /** 角色：ADMIN / USER */
  ZF.roleBadge = function (role) {
    if (role === 'ADMIN') {
      return '<span class="zf-badge zf-badge--primary">管理员</span>';
    }
    return '<span class="zf-badge">普通用户</span>';
  };

  /** 模板启用状态：enabled 为 true 启用 */
  ZF.enabledBadge = function (enabled) {
    return enabled
      ? '<span class="zf-badge zf-badge--ok">启用</span>'
      : '<span class="zf-badge zf-badge--mid">停用</span>';
  };

  /** 文章发布状态：1=已发布 / 0=草稿 */
  ZF.publishBadge = function (status) {
    return (status === 1 || status === '1')
      ? '<span class="zf-badge zf-badge--ok">已发布</span>'
      : '<span class="zf-badge zf-badge--mid">草稿</span>';
  };

  /** 问答状态：1=已回答 / 0=待回答 */
  ZF.qaStatusBadge = function (status) {
    return (status === 1 || status === '1')
      ? '<span class="zf-badge zf-badge--ok">已回答</span>'
      : '<span class="zf-badge zf-badge--mid">待回答</span>';
  };

  /* ---------------- 分类下拉：各模块共用一套候选，避免手输产生杂乱分类 ---------------- */

  /** 职场法律分类（文章 / 法律共用，与法条库的语义保持一致） */
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
   * @param {Array<string>} [extra]  需要额外补进来的历史值（老数据里的分类，避免编辑时丢失或筛不到）
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

  /** HTTP 方法徽标：GET/POST/PUT/DELETE 不同配色 */
  ZF.methodBadge = function (method) {
    var map = {
      GET: 'ok', POST: 'primary', PUT: 'mid', DELETE: 'high', PATCH: 'mid'
    };
    var cls = map[String(method || '').toUpperCase()] || 'primary';
    return '<span class="zf-badge zf-badge--' + cls + '">' + ZF.escape(method || '-') + '</span>';
  };

  /** HTTP 状态码徽标：2xx 绿、4xx 黄、5xx 红 */
  ZF.statusCodeBadge = function (code) {
    var n = Number(code);
    var cls = 'ok';
    if (n >= 500) { cls = 'high'; }
    else if (n >= 400) { cls = 'mid'; }
    else if (n >= 300) { cls = 'primary'; }
    return '<span class="zf-badge zf-badge--' + cls + '">' + ZF.escape(code) + '</span>';
  };

  /** 日期格式化封装（带时分） */
  ZF.dt = function (v) {
    return ZF.formatDate(v === undefined || v === null ? '' : v, true) || '-';
  };

  /** 日期格式化封装（仅日期） */
  ZF.dtDate = function (v) {
    return ZF.formatDate(v === undefined || v === null ? '' : v, false) || '-';
  };

  /** 空值占位：后端字段为空时统一显示 '-' */
  ZF.orDash = function (v) {
    return (v === undefined || v === null || v === '') ? '-' : v;
  };

  /* ==================================================================
   *  图表 resize 登记（窗口变化时统一重绘）
   * ================================================================== */

  /** 已注册的 ECharts 实例数组 */
  var CHARTS = [];

  /**
   * 登记一个 ECharts 实例，窗口 resize 时自动调用其 resize()。
   * @param {Object} chart echarts.init 返回的实例
   * @returns {Object} 同一实例，便于链式使用
   */
  ZF.registerChart = function (chart) {
    if (chart && typeof chart.resize === 'function') {
      CHARTS.push(chart);
    }
    return chart;
  };

  /** 触发所有已登记图表的 resize */
  ZF.resizeCharts = function () {
    CHARTS.forEach(function (c) {
      try { c.resize(); } catch (e) { /* 忽略已销毁实例 */ }
    });
  };

  window.addEventListener('resize', function () { ZF.resizeCharts(); });

  /* ==================================================================
   *  Bootstrap Table 统一初始化
   * ================================================================== */

  /**
   * 用一个统一配置初始化服务端分页的 Bootstrap Table。
   * 关键点：
   *  - 请求经 ZF.get 发送，自动拼接 /api 前缀并处理错误提示；
   *  - queryParams 把 Bootstrap Table 的 offset/limit 翻译成后端需要的 pageNum/pageSize；
   *  - 后端返回 {list,total,...}，在此映射为 Bootstrap Table 需要的 {total,rows}。
   *
   * @param {string} selector 表格选择器，如 '#user-table'
   * @param {string} apiPath 接口路径（不含 /api），如 '/users'
   * @param {Object} opts { pageSize, columns, queryParams, uniqueId }
   *                    queryParams 为函数，返回除分页外的额外筛选参数（每次刷新都重新读取）
   * @returns {jQuery} 表格 jQuery 对象
   */
  ZF.initAdminTable = function (selector, apiPath, opts) {
    opts = opts || {};
    var $table = $(selector);

    $table.bootstrapTable({
      locale: 'zh-CN',
      classes: 'table table-hover zf-table',
      sidePagination: 'server',
      pagination: true,
      pageNumber: 1,
      pageSize: opts.pageSize || 10,
      pageList: [10, 20, 50],
      uniqueId: opts.uniqueId || 'id',
      // 初始排序列（可选）：与列上的 sortable 配合，第一次加载就带上排序
      sortName: opts.sortName || undefined,
      sortOrder: opts.sortOrder || undefined,
      queryParams: function (params) {
        var extra = (typeof opts.queryParams === 'function') ? opts.queryParams() : {};
        return $.extend({
          pageNum: Math.floor(params.offset / params.limit) + 1,
          pageSize: params.limit,
          // 列头排序：bootstrap-table 把「点击的列名 + 方向」放在 params.sort / params.order。
          // 后端只把它当白名单查表的 key，非法值自动回退默认排序（见 SqlBuilder.orderBy）。
          sortName: params.sort || '',
          sortOrder: params.order || ''
        }, extra);
      },
      // 用自定义 ajax 把请求统一交给 ZF.get，从而复用 /api 前缀与错误提示
      ajax: function (request) {
        ZF.get(apiPath, request.data).then(function (page) {
          request.success({
            total: (page && page.total) || 0,
            rows: (page && page.list) || []
          });
        }).catch(function () {
          request.error('数据加载失败');
        });
      },
      columns: opts.columns || []
    });

    return $table;
  };

  /**
   * 触发表格重新加载并回到第 1 页（筛选条件变化后调用）。
   * @param {string} selector 表格选择器
   */
  ZF.refreshTable = function (selector) {
    $(selector).bootstrapTable('refresh', { pageNumber: 1 });
  };

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
   * 打开一个只读的详情弹窗。
   * @param {string} modalSelector 弹窗容器选择器（Bootstrap modal）
   * @param {string} title 弹窗标题
   * @param {string} bodyHtml 正文 HTML
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

})(window, jQuery);
