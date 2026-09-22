import sys
_OUT = open(r"D:\Program Files (x86)\gitee\zhixiaofa\workspace\_a11y_contrast_out.txt", "w", encoding="utf-8")

def print(*a, **k):
    _OUT.write(" ".join(str(x) for x in a) + "\n")

def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

def L(rgb):
    r, g, b = [lin(x) for x in rgb]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def ratio(a, b):
    la, lb = L(a), L(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

def hx(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

print("=== current values ===")
print("ink-3 7f8d9f on white    : %.3f" % ratio(hx('7f8d9f'), (255, 255, 255)))
print("ink-3 7f8d9f on f0f6ff   : %.3f" % ratio(hx('7f8d9f'), hx('f0f6ff')))
print("ink-3 7f8d9f on eff1f4   : %.3f" % ratio(hx('7f8d9f'), hx('eff1f4')))
print("ink-3 7f8d9f on f7f8fa   : %.3f" % ratio(hx('7f8d9f'), hx('f7f8fa')))
print("primary 4285f4 on white  : %.3f" % ratio(hx('4285f4'), (255, 255, 255)))
print("white on primary 4285f4  : %.3f" % ratio((255, 255, 255), hx('4285f4')))
print("primary-ink 003e8f white : %.3f" % ratio(hx('003e8f'), (255, 255, 255)))
print("primary-ink 003e8f dbeafe: %.3f" % ratio(hx('003e8f'), hx('dbeafe')))
print("primary-dark 2b6cd4 white: %.3f" % ratio(hx('2b6cd4'), (255, 255, 255)))
print("ink-2 333942 on white    : %.3f" % ratio(hx('333942'), (255, 255, 255)))

print()
print("=== ink-3 candidates: need >=4.5 vs worst bg eff1f4 ===")
for c in ['6b7787', '6a7686', '697686', '66707f', '5f6b7a', '5e6a79',
          '5c6775', '5b6673', '596372', '6e7a8b']:
    rw = ratio(hx(c), (255, 255, 255))
    rp = ratio(hx(c), hx('f0f6ff'))
    rm = ratio(hx(c), hx('eff1f4'))
    r2 = ratio(hx(c), hx('f7f8fa'))
    ok = 'OK ' if min(rw, rp, rm, r2) >= 4.5 else 'NG '
    print("%s #%s  white=%.2f blue=%.2f mute=%.2f soft=%.2f" % (ok, c, rw, rp, rm, r2))

print()
print("=== primary-as-text candidates: need >=4.5 on white ===")
for c in ['2b6cd4', '2a6ad0', '1a73e8', '1967d2', '1668d9', '1b66c9', '2160a8', '1155cc']:
    print("  #%s on white = %.2f   white-on-it = %.2f" %
          (c, ratio(hx(c), (255, 255, 255)), ratio((255, 255, 255), hx(c))))

print()
print("=== chip active (white on primary) candidates, need >=4.5 ===")
for c in ['2b6cd4', '2a6ad0', '1967d2', '1b66c9', '2160a8', '1553b0']:
    print("  #%s white-on-it = %.2f   it-on-white = %.2f" %
          (c, ratio((255, 255, 255), hx(c)), ratio(hx(c), (255, 255, 255))))
