# -*- coding: utf-8 -*-
"""把「账号信息」块从左栏移到右栏资料表单之后（卡片尾部，无分割线）。"""
import io

p = 'src/main/webapp/pages/profile.html'
s = io.open(p, encoding='utf-8', newline='').read()

start = s.find('            <!-- 账号信息：')
end = s.find('</div>\n          </div>', start)
assert start > 0 and end > start, (start, end)
block = s[start:end + len('</div>')]
print('--- 提取到的块 ---')
print(block)

# 1) 从原位置删掉（连同其后空行）
after = s[end + len('</div>'):]
if block + '\n' in s:
    s = s.replace(block + '\n', '', 1)
else:
    s = s.replace(block, '', 1)

# 2) 补回右栏：放到 </form> 之后 —— 卡片尾部，不再用 border-top 分割
form_end = s.find('            </form>', s.find('id="profile-form"'))
assert form_end > 0
insert_at = form_end + len('            </form>\n')

# 缩进调整为 12 空格（原为 12，同一层级）
block2 = block.replace('            <!-- 账号信息', '            <!-- 账号信息')
# 去掉"在下"表述，改为"在右"
block2 = block2.replace(
    '放在最近动态之下，把左栏剩余高度用掉，让两侧底边齐到最后。',
    '放在资料表单下方填充卡片尾部高度 —— 表格上方不加分割线，\n                 以复用卡片自带的留白节奏。')
# 缩进：块内每行前加 0（层级相同）
s = s[:insert_at] + block2 + '\n' + s[insert_at:]

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('\n=== 移动完成 ===')
i = s.find('<!-- 账号信息')
print(s[i - 900:i + 1500])
