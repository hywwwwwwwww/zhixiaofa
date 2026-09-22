# -*- coding: utf-8 -*-
"""把「账号信息」从 #panel-profile 内挪到 .zf-work 内、三个面板之后。
理由（实测）：账号信息在 panel 内时，切到「收藏/修改密码」页签后该 panel 变 hidden，
卡片高度 607 → 496，左栏（等高）跟着塌 111px，页面明显跳动。
放到 .zf-work 层作为常驻块，三个页签下都在，高度恒定。"""
import io

p = 'src/main/webapp/pages/profile.html'
s = io.open(p, encoding='utf-8', newline='').read()

start = s.find('            <!-- 账号信息：')
end = s.find('</div>', s.find('class="zf-acct__list"', start))
# 找到该 block 的收尾 </div>（zf-acct 自身）
anchor = s.find('<div class="zf-acct"', start)
# 逐层计数到 zf-acct 的闭合
i = s.find('>', anchor) + 1
depth = 1
while depth > 0:
    nxt_open = s.find('<div', i)
    nxt_close = s.find('</div>', i)
    if nxt_open != -1 and nxt_open < nxt_close:
        depth += 1
        i = nxt_open + 4
    else:
        depth -= 1
        i = nxt_close + 6
block = s[start:i]
print('=== 块长度', len(block))

s = s.replace(block + '\n', '', 1)

# 插到 .zf-work 的末尾（三个 tabpanel 之后、.zf-work 收尾 </div> 之前）
fav_end = s.find('</div>', s.find('id="fav-pager"'))
# fav_end 是 favorites 面板内部的收尾，需再找 panel 的 </div>
p2 = s.find('</div>', fav_end + 6)   # favorites panel 收尾
print('插入点上下文:')
print(repr(s[p2 - 200:p2 + 120]))
s = s[:p2 + 6] + '\n\n' + block + s[p2 + 6:]

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('\n=== 完成 ===')
i = s.find('<!-- 账号信息')
print(s[i - 500:i + 900])
