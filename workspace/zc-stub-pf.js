/**
 * profile.html 专用鉴权桩。
 *
 * 作用：把 XMLHttpRequest 重写掉，直接返回 {code:10000, message:'ok', data:...} 信封，
 * 让页面在 file:// 下不必跑后端也能真实渲染（ZF.CODE_SUCCESS === 10000）。
 * 同时拦掉未登录跳转 login.html。
 *
 * 数据刻意与 sql/data.sql 的契约一致：
 *   - /contracts/mine 的 riskLevel 是**中文**「高/中/低」（schema + 种子数据 + Mapper 均为中文）
 *   - /qa/mine 的字段是 question（不是 title）
 *   - 四个列表接口都按 id DESC，所以 pageSize=2 时的 list[0] 就是"最新一条"
 */
(function () {
  'use strict';

  var USER = {
    id: 2, username: 'lisi', nickname: '李四', role: 'USER',
    email: 'lisi@example.com', phone: '+86 138-0000-0001',
    city: '杭州', jobTitle: '人力资源专员',
    avatar: '',
    lastLoginAt: '2026-09-16T09:41:00',
    createdAt: '2026-01-05T09:12:00'
  };

  // 各模块列表（按 id DESC 的顺序，即"最新的在前"）
  var QA = [
    { id: 42, question: '试用期被公司辞退，能否要求经济补偿金？', answer: '……',
      category: '劳动合同', status: 1, likeCount: 6, createdAt: '2026-09-14T15:20:00' },
    { id: 41, question: '加班费的计算基数如何确定？', answer: '……',
      category: '工资福利', status: 1, likeCount: 3, createdAt: '2026-09-11T10:02:00' }
  ];
  var CT = [
    { id: 12, fileName: '劳动合同-李四.pdf', contractType: '劳动合同',
      partyA: '某某科技有限公司', partyB: '李四', riskLevel: '高', riskCount: 3,
      status: 1, createdAt: '2026-09-15T11:08:00' },
    { id: 11, fileName: '实习协议-李四.docx', contractType: '实习协议',
      partyA: '某某网络科技有限公司', partyB: '李四', riskLevel: '中', riskCount: 2,
      status: 1, createdAt: '2026-09-02T09:40:00' }
  ];
  var DOC = [
    { id: 21, title: '劳动仲裁申请书', templateName: '劳动仲裁申请书', templateId: 3,
      createdAt: '2026-09-13T17:44:00' },
    { id: 20, title: '离职通知书', templateName: '离职通知书', templateId: 5,
      createdAt: '2026-08-29T14:11:00' }
  ];
  var FAV = { QA: 3, ARTICLE: 2, LAW: 1, DOC: 1 };

  function page(list, params) {
    var size = parseInt((params || {}).pageSize, 10) || 10;
    return {
      total: list.length, pageNum: 1, pageSize: size,
      list: list.slice(0, size)
    };
  }

  function route(url, params) {
    var u = url.split('?')[0];
    params = params || {};
    if (u === '/api/auth/profile' || u.indexOf('/auth/profile') >= 0) { return USER; }
    if (u.indexOf('/qa/mine') >= 0) { return page(QA, params); }
    if (u.indexOf('/contracts/mine') >= 0) { return page(CT, params); }
    if (u.indexOf('/doc-records/mine') >= 0) { return page(DOC, params); }
    if (u.indexOf('/favorites') >= 0) {
      var t = params.targetType || 'QA';
      var n = FAV[t] || 0;
      var list = [];
      for (var i = 0; i < Math.min(n, 8); i++) {
        list.push({
          id: 100 + i, targetType: t, targetId: 900 + i,
          targetTitle: (t === 'QA' ? '试用期被辞退的经济补偿问题 #' : '劳动合同模板条款解读 #') + (i + 1),
          targetSummary: '这是一条用于验证分页与列表渲染的收藏摘要文本，长度足够触发 truncate。',
          createdAt: '2026-09-' + (10 + i) + 'T10:00:00'
        });
      }
      return { total: n, pageNum: 1, pageSize: 8, list: list };
    }
    if (u.indexOf('/auth/me') >= 0) { return USER; }
    if (u.indexOf('/auth/login') >= 0) { return USER; }
    if (u.indexOf('/auth/logout') >= 0) { return null; }
    if (u.indexOf('/auth/password') >= 0) { return null; }
    return null;
  }

  var OPEN = XMLHttpRequest.prototype.open;
  var SEND = XMLHttpRequest.prototype.send;
  var SETHEADER = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url) {
    // 拦掉未登录跳转
    if (String(url).indexOf('login.html') >= 0) {
      this.__blocked = true;
      this.__url = String(url);
      return;
    }
    this.__method = method;
    this.__url = String(url);
    return OPEN.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function () {
    if (this.__blocked) { return; }
    return SETHEADER.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (this.__blocked) { return; }

    var self = this;
    var url = self.__url || '';
    var params = {};
    var qi = url.indexOf('?');
    if (qi >= 0) {
      url.slice(qi + 1).split('&').forEach(function (kv) {
        var p = kv.split('=');
        params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
      });
    }
    // 简易 POST body 解析（本项目提交 json）
    if (body) {
      try {
        var parsed = JSON.parse(body);
        Object.keys(parsed).forEach(function (k) { params[k] = parsed[k]; });
      } catch (e) { /* 表单编码，忽略 */ }
    }

    var data = route(url, params);
    var payload = JSON.stringify({ code: 10000, message: 'ok', data: data });

    setTimeout(function () {
      try {
        Object.defineProperty(self, 'readyState', { value: 4, configurable: true });
        Object.defineProperty(self, 'status', { value: 200, configurable: true });
        Object.defineProperty(self, 'responseText', { value: payload, configurable: true });
        Object.defineProperty(self, 'response', { value: payload, configurable: true });
        if (typeof self.onload === 'function') { self.onload(); }
        if (typeof self.onreadystatechange === 'function') { self.onreadystatechange(); }
        self.dispatchEvent(new Event('load'));
        self.dispatchEvent(new Event('loadend'));
      } catch (e) {
        console.log('STUB ERROR', e);
      }
    }, 20);
  };

  window.__ZF_STUB__ = route;
})();
