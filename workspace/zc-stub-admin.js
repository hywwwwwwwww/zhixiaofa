/**
 * admin/index.html 专用鉴权桩（在 zc-stub-home.js 基础上把角色改成 ADMIN）。
 *
 * 【为什么要单独一份】admin 页用 ZF.initPage({ needAdmin: true })，
 * ZF.requireLogin 里 `if (needAdmin && user.role !== 'ADMIN')` 会
 * `window.location.href = CTX + '/pages/home.html'`。用角色为 USER 的桩时，
 * 页面 1 秒后自动跳回首页 —— 实测探针读到的是 home.html 的文档，
 * 会把 home 的样式误判成"作用域泄漏到 admin"，6 条断言集体误报。
 */
(function () {
  'use strict';

  var USER = {
    id: 1, username: 'admin', nickname: '管理员', role: 'ADMIN',
    email: 'admin@example.com', phone: '13800000000',
    city: '杭州', jobTitle: '',
    avatar: '',
    lastLoginAt: '2026-09-17T09:00:00',
    createdAt: '2026-01-01T09:00:00'
  };

  function route(url, params) {
    var u = url.split('?')[0];
    if (u.indexOf('/auth/profile') >= 0 || u.indexOf('/auth/me') >= 0) { return USER; }
    if (u.indexOf('/auth/login') >= 0) { return USER; }
    if (u.indexOf('/admin/stats') >= 0 || u.indexOf('/stats') >= 0) {
      return {
        userCount: 128, qaCount: 342, contractCount: 76,
        courtCaseCount: 51, docCount: 88, articleCount: 24,
        riskCount: 37, logCount: 1520
      };
    }
    if (u.indexOf('/auth/logout') >= 0) { return null; }
    return null;
  }

  var OPEN = XMLHttpRequest.prototype.open;
  var SEND = XMLHttpRequest.prototype.send;
  var SETHEADER = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url) {
    // 记录跳转意图但不真的跳（便于探针诊断），同时阻断 login.html
    if (String(url).indexOf('login.html') >= 0) {
      this.__blocked = true; this.__url = String(url); return;
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
    if (body) {
      try {
        var parsed = JSON.parse(body);
        Object.keys(parsed).forEach(function (k) { params[k] = parsed[k]; });
      } catch (e) { /* 忽略 */ }
    }
    var payload = JSON.stringify({ code: 10000, message: 'ok', data: route(url, params) });
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
      } catch (e) { console.log('STUB ERROR', e); }
    }, 20);
  };

  window.__ZF_STUB__ = route;
})();
