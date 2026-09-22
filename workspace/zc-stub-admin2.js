/**
 * 管理端 10 个页面的**通用鉴权桩**（替代 zc-stub-admin.js）。
 *
 * 【与旧桩的区别】
 * 旧桩只覆盖 /auth/* 与 /stats，管理端的 9 个业务列表接口（/users、/qa、
 * /contracts、/laws、/knowledge、/doc-templates、/quiz、/logs）全部返回 null，
 * Bootstrap Table 会渲染成空表 —— 那就测不出「列是否渲染、排序是否生效、
 * 操作列按钮是否可点」这些真正要验证的东西。
 *
 * 本桩为每个模块造**足够条目**（11 条，配合 10/页分页能验证翻页），
 * 并且字段按各页 columns 的真实 field 填，避免出现大片 '-'。
 *
 * 【角色必须是 ADMIN】
 * 管理端用 ZF.initAdminPage，其中 `if (user.role !== 'ADMIN')` 会走
 * renderAdminDenied。测「正常管理端」时角色必须给 ADMIN；
 * 测「非管理员提示页」时请用 zc-stub-admin-user.js（role=USER）。
 */
(function () {
  'use strict';

  var USER = {
    id: 1, username: 'admin', nickname: '管理员', role: 'ADMIN',
    email: 'admin@example.com', phone: '13800000000',
    city: '杭州', jobTitle: '法务', avatar: '',
    lastLoginAt: '2026-09-21T09:00:00',
    createdAt: '2026-01-01T09:00:00'
  };

  /** 造 n 条，字段取 `fn(i)` */
  function make(n, fn) {
    var out = [];
    for (var i = 1; i <= n; i++) { out.push(fn(i)); }
    return out;
  }

  var CATS = ['劳动合同', '工资报酬', '工时休假', '社会保险', '解除终止', '竞业限制', '其他'];

  /** 各模块列表数据（模块 key -> 数组） */
  var DATA = {
    users: make(11, function (i) {
      return {
        id: i, username: 'user' + i, nickname: '测试用户' + i,
        email: 'u' + i + '@example.com', phone: '1380000' + (1000 + i),
        role: i % 5 === 0 ? 'ADMIN' : 'USER',
        status: i % 4 === 0 ? 0 : 1,
        city: ['杭州', '济南', '北京', '上海'][i % 4],
        jobTitle: ['法务专员', '人事经理', '普通职员', '实习生'][i % 4],
        lastLoginAt: '2026-09-2' + (i % 9) + 'T10:00:00',
        createdAt: '2026-0' + ((i % 9) + 1) + '-01T09:00:00'
      };
    }),
    qa: make(11, function (i) {
      return {
        id: i, question: '公司未签订书面劳动合同，我可以主张双倍工资吗？（第 ' + i + ' 问）',
        answer: i % 3 === 0 ? '' : '根据《劳动合同法》第八十二条，用人单位自用工之日起超过一个月不满一年未与劳动者订立书面劳动合同的，应当向劳动者每月支付二倍的工资。',
        status: i % 3 === 0 ? 0 : 1,
        category: CATS[i % CATS.length],
        askedAt: '2026-09-1' + (i % 9) + 'T14:30:00',
        createdAt: '2026-09-1' + (i % 9) + 'T14:30:00'
      };
    }),
    contracts: make(11, function (i) {
      return {
        id: i, title: '劳动合同（' + i + '号样本）', company: '某某科技有限公司' + i,
        riskCount: i % 5, riskLevel: ['低', '中', '高'][i % 3],
        createdAt: '2026-09-0' + ((i % 9) + 1) + 'T11:00:00',
        status: 1
      };
    }),
    laws: make(11, function (i) {
      return {
        id: i, title: '中华人民共和国劳动法（第 ' + i + ' 条）',
        category: CATS[i % CATS.length],
        content: '用人单位应当依法建立和完善规章制度，保障劳动者享有劳动权利和履行劳动义务。这是第 ' + i + ' 条的内容摘要。',
        source: '全国人民代表大会常务委员会', effectiveDate: '2026-01-01',
        createdAt: '2026-0' + ((i % 9) + 1) + '-01T08:00:00'
      };
    }),
    knowledge: make(11, function (i) {
      return {
        id: i, title: '职场法律知识第 ' + i + ' 篇：试用期那些事',
        summary: '试用期最长不得超过六个月，且同一用人单位与同一劳动者只能约定一次试用期。',
        category: CATS[i % CATS.length],
        status: i % 4 === 0 ? 0 : 1,
        views: 100 + i * 7,
        author: '职小法编辑部',
        createdAt: '2026-08-2' + (i % 9) + 'T16:00:00',
        updatedAt: '2026-09-1' + (i % 9) + 'T16:00:00'
      };
    }),
    templates: make(11, function (i) {
      return {
        id: i, name: '劳动仲裁申请书（' + i + '）',
        category: ['函件', '申请', '通知', '仲裁', '协议', '其他'][i % 6],
        description: '适用于向劳动争议仲裁委员会提起仲裁申请的标准化文书模板。',
        enabled: i % 4 !== 0,
        fieldCount: 4 + (i % 5),
        createdAt: '2026-07-1' + (i % 9) + 'T09:30:00'
      };
    }),
    quiz: make(11, function (i) {
      var opts = ['A. 双倍工资', 'B. 三倍工资', 'C. 补缴社保', 'D. 无赔偿'];
      return {
        id: i, question: '用人单位违法解除劳动合同，劳动者可以主张什么？（第 ' + i + ' 题）',
        optionA: opts[0], optionB: opts[1], optionC: opts[2], optionD: opts[3],
        answer: ['A', 'B', 'C', 'D'][i % 4],
        category: ['劳动合同', '工资报酬', '工时休假', '社会保险', '解除终止', '竞业限制', '试用期', '其他'][i % 8],
        analysis: '根据《劳动合同法》第四十八条、第八十七条，违法解除应支付二倍经济补偿标准的赔偿金。',
        difficulty: (i % 3) + 1,
        createdAt: '2026-08-0' + ((i % 9) + 1) + 'T10:00:00'
      };
    }),
    logs: make(11, function (i) {
      return {
        id: i, method: ['GET', 'POST', 'PUT', 'DELETE'][i % 4],
        uri: ['/api/users', '/api/qa', '/api/contracts', '/api/laws'][i % 4] + '?pageNum=' + i,
        statusCode: [200, 200, 200, 400, 500][i % 5],
        username: 'user' + i, ip: '192.168.1.' + (10 + i),
        durationMs: 20 + i * 13,
        createdAt: '2026-09-21T1' + (i % 9) + ':30:00'
      };
    })
  };

  /** 模块 key -> 对应后端路径片段 */
  var PATH_MAP = [
    ['/doc-templates', 'templates'],
    ['/users', 'users'],
    ['/qa', 'qa'],
    ['/contracts', 'contracts'],
    ['/laws', 'laws'],
    ['/knowledge', 'knowledge'],
    ['/quiz', 'quiz'],
    ['/logs', 'logs']
  ];

  function route(url, params) {
    var u = String(url).split('?')[0];

    /* ---- 鉴权 ---- */
    if (u.indexOf('/auth/profile') >= 0 || u.indexOf('/auth/me') >= 0) { return USER; }
    if (u.indexOf('/auth/login') >= 0) { return USER; }
    if (u.indexOf('/auth/logout') >= 0) { return null; }

    /* ---- 数据看板：6 个独立接口，字段形状按 index.html 的实际读取方式给 ---- */

    /* 6b. 日志页的两个 Top 柱状图（logs.html 读 res.uri / res.slow，均为 [{label,value}]）
       注意必须排在下面通用的 /admin/logs 列表之前判断。 */
    if (u.indexOf('/admin/logs/stats') >= 0) {
      return {
        uri: [
          { label: '/api/qa/page', value: 320 }, { label: '/api/users/page', value: 280 },
          { label: '/api/contracts/page', value: 214 }, { label: '/api/laws/page', value: 176 },
          { label: '/api/knowledge/page', value: 121 }
        ],
        slow: [
          { label: '/api/contracts/review', value: 1420 }, { label: '/api/laws/sync', value: 1080 },
          { label: '/api/qa/ask', value: 760 }, { label: '/api/court/cases', value: 430 }
        ]
      };
    }

    /* ---- 法律管理：laws.html 直接调真实业务接口 /law-articles/*，
           不是 /admin/* 那套，所以这里要单独补。 ---- */
    if (u.indexOf('/law-articles/sync/status') >= 0) {
      return { running: false, lastResult: '' };
    }
    if (u.indexOf('/law-articles/law-names') >= 0) {
      return ['中华人民共和国劳动法', '中华人民共和国劳动合同法', '中华人民共和国社会保险法'];
    }
    if (u.indexOf('/law-articles/categories') >= 0) {
      return ['劳动合同', '工资报酬', '工时休假', '社会保险', '解除终止'];
    }
    if (u.indexOf('/law-articles') >= 0) {
      /* 【形状对齐】列表分页统一用 `{list,total}` —— admin-common.js 的
         ZF.initAdminTable 在自定义 ajax 里读的是 `page.list`（不是 `rows`），
         给错了会出现「total 有值但表格显示没有找到匹配的记录」的迷惑现象。 */
      var all = make(11, function (i) {
        return {
          id: i,
          lawName: ['中华人民共和国劳动法', '中华人民共和国劳动合同法', '中华人民共和国社会保险法'][i % 3],
          articleNo: '第' + (i + 3) + '条',
          category: ['劳动合同', '工资报酬', '工时休假', '社会保险', '解除终止'][i % 5],
          title: '第' + ((i % 4) + 1) + '章 总则',
          keywords: '劳动,合同,履行',
          effectiveDate: '2026-0' + ((i % 9) + 1) + '-01',
          content: '用人单位与劳动者应当按照劳动合同的约定，全面履行各自的义务。',
          createdAt: '2026-07-1' + (i % 9) + 'T09:00:00'
        };
      });
      var pn = parseInt(params.pageNum, 10) || 1;
      var ps = parseInt(params.pageSize, 10) || 10;
      return { list: all.slice((pn - 1) * ps, pn * ps), total: all.length };
    }

    /* 6. 慢接口（注意必须排在 /admin/stats/overview 之前判断，否则被通用规则吃掉） */
    if (u.indexOf('/admin/stats/slow-apis') >= 0) {
      return [
        { label: '/api/court/cases', value: 1240 }, { label: '/api/contracts/review', value: 980 },
        { label: '/api/laws/search', value: 640 }, { label: '/api/qa/ask', value: 520 },
        { label: '/api/knowledge/list', value: 310 }
      ];
    }
    /* 5. 连接池信息 */
    if (u.indexOf('/admin/stats/pool') >= 0) {
      return {
        minIdle: 2, maxTotal: 20, created: 8, idle: 6, borrowed: 2,
        pageDefaultSize: 10, pageMaxSize: 50,
        jdbcUrl: 'jdbc:mysql://localhost:3306/zhixiaofa'
      };
    }
    /* 4. 排行榜（4 个列表，均是 [{label,value}]） */
    if (u.indexOf('/admin/stats/rankings') >= 0) {
      return {
        articleViews: [
          { label: '试用期那些事', value: 860 }, { label: '加班费计算', value: 720 },
          { label: '竞业限制详解', value: 640 }, { label: '工伤认定流程', value: 520 },
          { label: '社保断缴影响', value: 410 }
        ],
        topLaws: [
          { label: '劳动合同法 §82', value: 310 }, { label: '劳动合同法 §47', value: 280 },
          { label: '劳动法 §44', value: 220 }, { label: '社会保险法 §58', value: 180 }
        ],
        hotQuestions: [
          { label: '未签合同能否主张双倍工资', value: 156 },
          { label: '试用期被辞退有赔偿吗', value: 132 },
          { label: '加班费怎么算', value: 118 }
        ],
        riskClauses: [
          { label: '违约金约定过高', value: 96 }, { label: '竞业限制无补偿', value: 78 },
          { label: '工时条款违法', value: 54 }
        ],
        templateUsage: [
          { label: '劳动仲裁申请书', value: 88 }, { label: '解除通知函', value: 62 },
          { label: '离职证明', value: 45 }
        ]
      };
    }
    /* 3. 分布（3 个饼图，均是 [{label,value}]） */
    if (u.indexOf('/admin/stats/distributions') >= 0) {
      return {
        qaCategory: [
          { label: '劳动合同', value: 86 }, { label: '工资报酬', value: 64 },
          { label: '工时休假', value: 42 }, { label: '社会保险', value: 51 },
          { label: '解除终止', value: 37 }, { label: '其他', value: 22 }
        ],
        contractRisk: [
          { label: '低风险', value: 42 }, { label: '中风险', value: 24 }, { label: '高风险', value: 10 }
        ],
        caseType: [
          { label: '劳动报酬', value: 28 }, { label: '解除争议', value: 18 },
          { label: '工伤', value: 9 }, { label: '社保', value: 14 }
        ]
      };
    }
    /* 2. 趋势（series.labels 是 [{label}]，series 下按 key 给数值数组） */
    if (u.indexOf('/admin/stats/trend') >= 0) {
      var n = parseInt(params.days || 14, 10) || 14;
      var labels = [];
      for (var d = n - 1; d >= 0; d--) {
        labels.push({ label: '9-' + (21 - d) });
      }
      return {
        series: {
          labels: labels,
          users: labels.map(function (_, i) { return 3 + (i % 7); }),
          qa: labels.map(function (_, i) { return 12 + (i % 9) * 2; }),
          contracts: labels.map(function (_, i) { return 5 + (i % 5); })
        }
      };
    }
    /* 1. 概览（指标卡，11 个 key） */
    if (u.indexOf('/admin/stats/overview') >= 0) {
      return {
        userCount: 128, qaCount: 342, contractCount: 76, courtCaseCount: 51,
        docCount: 88, templateCount: 12, articleCount: 24, lawCount: 156,
        quizCount: 210, riskCount: 37, logCount: 1520
      };
    }
    /* 兜底：任何 /stats 前缀（旧桩兼容） */
    if (u.indexOf('/stats') >= 0) {
      return {
        userCount: 128, qaCount: 342, contractCount: 76,
        courtCaseCount: 51, docCount: 88, articleCount: 24,
        lawCount: 156, quizCount: 210, logCount: 1520, riskCount: 37
      };
    }

    /* ---- 各模块列表（服务端分页） ---- */
    for (var i = 0; i < PATH_MAP.length; i++) {
      var seg = PATH_MAP[i][0];
      var key = PATH_MAP[i][1];
      if (u.indexOf(seg) >= 0) {
        var all = DATA[key] || [];
        var pn = parseInt(params.pageNum || 1, 10) || 1;
        var ps = parseInt(params.pageSize || 10, 10) || 10;
        var start = (pn - 1) * ps;
        return {
          list: all.slice(start, start + ps),
          total: all.length,
          pages: Math.ceil(all.length / ps),
          pageNum: pn, pageSize: ps
        };
      }
    }

    return null;
  }

  var OPEN = XMLHttpRequest.prototype.open;
  var SEND = XMLHttpRequest.prototype.send;
  var SETHEADER = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url) {
    /* 拦掉跳登录页（未登录时守卫会跳），避免探针读到 login 文档 */
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
      } catch (e) { /* 忽略非 JSON 体 */ }
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
      } catch (e) { /* 忽略 */ }
    }, 20);
  };

  window.__ZF_STUB__ = route;
  window.__ZF_STUB_DONE__ = true;   /* 哨兵：整段跑完的信号 */
})();
