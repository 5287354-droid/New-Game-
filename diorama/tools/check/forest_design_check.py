# ランプの森の作り直し案(docs/maps/forest.md)を描いて、ランプの向き × 連結成分 の幅優先で確かめる
# 使い方: python3 tools/check/forest_design_check.py [map]
import sys
class M:
    def __init__(s,w,d,ch='.'): s.w,s.d=w,d; s.g=[[ch]*w for _ in range(d)]
    def set(s,x,z,c):
        if 0<=x<s.w and 0<=z<s.d: s.g[z][x]=c
    def rect(s,x0,z0,x1,z1,c):
        for z in range(z0,z1+1):
            for x in range(x0,x1+1): s.set(x,z,c)
    def box(s,x0,z0,x1,z1,door,fill='f'):
        s.rect(x0,z0,x1,z1,'W'); s.rect(x0+1,z0+1,x1-1,z1-1,fill)
        for d in door: s.set(*d,'D')
    def put(s,pts,c):
        for x,z in pts: s.set(x,z,c)
    def show(s):
        out=['    '+''.join(str(x//10) if x%10==0 else ' ' for x in range(s.w)), '    '+''.join(str(x%10) for x in range(s.w))]
        for z in range(s.d): out.append(f'{z:3d} '+''.join(s.g[z]))
        return '\n'.join(out)

W,D=56,48
m=M(W,D,'.')
def ch(x0,z0,x1,z1): m.rect(x0,z0,x1,z1,'c')
ch(14,0,17,47); ch(27,0,33,47); ch(42,0,45,47); ch(18,22,26,24)
m.rect(29,18,31,24,'.')   # 谷2の柱(島)
m.rect(43,27,44,29,'.')   # 谷3の島 I1
m.rect(43,16,44,17,'.')   # 谷3の島 I2
m.rect(43,31,44,32,'.')   # 谷3の行き止まりの島 I3(宝)
m.rect(18,40,26,47,'.'); m.rect(18,39,26,39,'X')  # F1 南西のくぼみ(岩でふさがれた行き止まり)
m.rect(0,46,13,47,'d')
casters=[]  # (x,z,angle,len,wide)  影は幹の手前(南)の wide 列に、光と反対の向きへ len マス
def cast(x,z,ang,ln,wd,kind='T'):
    casters.append((x,z,ang,ln,wd)); m.set(x,z,kind)
cast(18,29,0,4,2)        # C1 谷1: 東の光
cast(13,39,2,4,1)        # はじめから見える影の橋(西の光)→くぼみの宝
cast(29,19,0,2,2)        # C2 西半分: 東の光
cast(31,22,2,2,2)        # C2 東半分: 西の光
cast(41,26,2,2,2)        # C3 第1脚 F2→I1: 西の光
cast(44,14,1,0,0,'A')    # C3 第2・3脚: 真上の光で、大枝のアーチ(x42-45,z15-18 と 18-26 の柱)
cast(44,29,0,1,1)        # I1 の上の木。東の光で I3 への行き止まりの橋 (43..44,30)
cast(20,21,1,0,0,'A')    # 東西の谷: 真上の光で、アーチ(x20-22,z22-24)
shadow={0:set(),1:set(),2:set()}
for x,z,a,ln,wd in casters:
    for r in range(1,wd+1):
        for i in range(0,ln+1):
            xx = x-i if a==0 else x+i
            shadow[a].add((xx,z+r))
# アーチの足もと(真上の光)
for x in range(43,46):
    for z in range(15,19): shadow[1].add((x,z))
for x in range(43,45):
    for z in range(18,27): shadow[1].add((x,z))
for x in range(20,23):
    for z in range(22,25): shadow[1].add((x,z))
for a in (0,1,2):
    mm=M(W,D); mm.g=[row[:] for row in m.g]
    for (x,z) in shadow[a]:
        if mm.g[z][x]=='c': mm.g[z][x]='#'
    if 'map' in sys.argv: print(f'--- 角度{a}'); print(mm.show())
# 物
for x,z,c in [(8,34,'*'),(22,27,'*'),(24,12,'*'),(30,21,'*'),(38,30,'*'),(43,28,'*'),(50,20,'*')]: m.set(x,z,c)
for x,z in [(3,3),(20,4),(30,23),(38,40),(52,44),(22,44),(2,22),(43,32),(50,40)]: m.set(x,z,'$')
m.set(50,12,'!'); m.set(6,42,'?'); m.put([(6,47),(7,47)],'E')
m.set(5,6,'i'); m.set(41,2,'o'); m.rect(46,5,55,5,'X'); m.set(52,2,'$')
if 'map' in sys.argv: print(m.show())

# ---- 検証(ランプの向き × 連結成分 の幅優先)
from collections import deque
def solve(tweezers):
    sh={a:set(shadow[a]) for a in shadow}
    if tweezers:
        for i in range(0,5): sh[2].add((41+i,3))
    def walk(x,z,a):
        if not(0<=x<W and 0<=z<D): return False
        c=m.g[z][x]
        if c in '.d*E': return True
        if c=='c': return (x,z) in sh[a]
        return False
    def comp(a,p):
        seen={p}; q=deque([p])
        while q:
            x,z=q.popleft()
            for dx,dz in ((1,0),(-1,0),(0,1),(0,-1)):
                n=(x+dx,z+dz)
                if n not in seen and walk(*n,a): seen.add(n); q.append(n)
        return frozenset(seen)
    start=(6,45); st={}; q=deque()
    def push(a,p,d):
        c=comp(a,p); k=(a,min(c))
        if k in st: return
        st[k]=(c,d); q.append(k)
    push(2,start,0)
    while q:
        k=q.popleft(); c,d=st[k]
        for p in c:
            if m.g[p[1]][p[0]]=='*': push((k[0]+1)%3,p,d+1)
    targets={(x,z):m.g[z][x] for z in range(D) for x in range(W) if m.g[z][x] in '$!'}
    res={}
    for t in targets:
        best=None
        for (a,_),(c,d) in st.items():
            if any((t[0]+dx,t[1]+dz) in c for dx,dz in ((1,0),(-1,0),(0,1),(0,-1))):
                best=d if best is None else min(best,d)
        res[t]=best
    # 詰み: 出口(6,47)に戻れない状態
    goodk={k for k,(c,d) in st.items() if (6,46) in c}
    changed=True
    edges={k:set() for k in st}
    for k,(c,d) in st.items():
        for p in c:
            if m.g[p[1]][p[0]]=='*':
                c2=comp((k[0]+1)%3,p); edges[k].add(((k[0]+1)%3,min(c2)))
    while changed:
        changed=False
        for k in st:
            if k not in goodk and edges[k]&goodk: goodk.add(k); changed=True
    return res,len(st),len(st)-len(goodk)
for tw in (False,True):
    res,n,stuck=solve(tw)
    print('ピンセット' if tw else 'なし', '状態',n,'詰み',stuck)
    print('  ', ' '.join(f"{m.g[z][x]}({x},{z}):{'×' if v is None else v}" for (x,z),v in sorted(res.items())))
