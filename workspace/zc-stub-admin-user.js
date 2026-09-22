/**
 * 非管理员（role=USER）鉴权桩 —— 专测管理端的「仅管理员可访问」提示页。
 *
 * 与 zc-stub-admin2.js 的唯一差别：USER.role = 'USER'。
 * 用它会触发 ZF.initAdminPage 里的 renderAdminDenied。
 */
(function () {
  'use strict';

  var USER = {
    id: 2, username: 'normaluser', nickname: '普通用户', role: 'USER',
    email: 'user@example.com', phone: '13900000000',
    city: '济南', jobTitle: '职员', avatar: '',
    lastLoginAt: '2026-09-21T09:00:00',
    createdAt: '2026-02-01T09:00:00'
  };

  var OPEN = XMLHttpRequest.prototype.open;
  var SEND = XMLHttpRequest.prototype.send;
  var SETHEADER = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__method = method;
    this.__url = String(url);
    return OPEN.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function () {
    return SETHEADER.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    var self = this;
    var url = self.__url || '';
    var u = url.split('?')[0];
    var data = null;
    if (u.indexOf('/auth/profile') >= 0 || u.indexOf('/auth/me') >= 0) { data = USER; }
    if (u.indexOf('/auth/logout') >= 0) { data = null; }
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
      } catch (e) { /* 忽略 */ }
    }, 20);
  };

  window.__ZF_STUB_DONE__ = true;
})();
