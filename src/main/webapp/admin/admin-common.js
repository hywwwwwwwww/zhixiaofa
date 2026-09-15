/**
 * @file admin-common.js —— 后台管理公共脚本
 * @description 后台页面共用的横向导航、状态/角色/HTTP 方法徽标，以及统一的
 *              Bootstrap Table 初始化（请求经 ZF.get 走 /api 前缀，自动中文分页、
 *              响应映射为 {total, rows}）与 ECharts 图表 resize 登记。
 *              本文件依赖 common.js（提供 window.ZF），须在其之后引入。
 * @author 职小法小组
 * @version 1.0
 */

/* global jQuery, echarts */
(function (window, $) {
  'use strict';

  var ZF = window.ZF;
  if (!ZF) {
    return; // common.js 未加载则直接退出，避免后续报错
  }

  /* ==================================================================
   *  后台导航配置
   * ================================================================== */

  /** 后台模块导航：key 用于当前页高亮，href 均为 admin/ 目录下的相对路径 */
  var ADMIN_NAV = [
    { key: 'dashboard', text: '数据看板', icon: 'bi-speedometer2', href: 'index.html' },
    { key: 'users', text: '用户管理', icon: 'bi-people', href: 'users.html' },
    { key: 'qa', text: '问答管理', icon: 'bi-chat-square-text', href: 'qa.html' },
    { key: 'contracts', text: '合同管理', icon: 'bi-file-earmark-check', href: 'contracts.html' },
    { key: 'laws', text: '法条管理', icon: 'bi-book', href: 'laws.html' },
    { key: 'knowledge', text: '文章管理', icon: 'bi-journal-text', href: 'knowledge.html' },
    { key: 'templates', text: '模板管理', icon: 'bi-layout-text-window', href: 'doc-templates.html' },
    { key: 'quiz', text: '题库管理', icon: 'bi-patch-question', href: 'quiz.html' },
    { key: 'logs', text: '日志监控', icon: 'bi-activity', href: 'logs.html' }
  ];

  /**
   * 在内容区顶部的 #admin-nav 容器渲染后台专用导航（横向 pill 风格）。
   * 每个后台页面调用一次，传入当前模块 key 即可高亮并保持一致。
   * @param {string} activeKey 当前高亮模块 key
   */
  ZF.renderAdminNav = function (activeKey) {
    var $host = $('#admin-nav');
    if (!$host.length) {
      return;
    }
    var items = ADMIN_NAV.map(function (item) {
      var cls = 'zf-admin-nav__item' + (item.key === activeKey ? ' zf-admin-nav__item--active' : '');
      return '<a class="' + cls + '" href="' + ZF.escape(item.href) + '">' +
        '<i class="bi ' + item.icon + '"></i>' + ZF.escape(item.text) + '</a>';
    }).join('');
    var back = '<a class="zf-admin-nav__item zf-admin-nav__item--back" href="' + ZF.CTX + '/pages/home.html">' +
      '<i class="bi bi-box-arrow-left"></i>返回前台</a>';
    $host.html('<div class="zf-admin-nav">' + items + back + '</div>');
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
   * @param {Object} opts { pageSize, columns, queryParams }
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
      queryParams: function (params) {
        var extra = (typeof opts.queryParams === 'function') ? opts.queryParams() : {};
        return $.extend({
          pageNum: Math.floor(params.offset / params.limit) + 1,
          pageSize: params.limit
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

})(window, jQuery);
