# 把 Surge XT 的 .fxp 出厂音色装进 pedalboard 里的 Surge XT 插件。
# pedalboard 的 raw_state 是 JUCE 的 VST3 状态：XML 里 <IComponent> 存着插件自己的状态，
# 用 JUCE 自定义的 base64（"字节数.编码"）编码。Surge 的状态就是 .fxp 去掉 FXP 文件头后的那段数据。
import struct
ALPHA=".ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+"
def juce_decode(s):
    n,data=s.split('.',1);n=int(n);out=bytearray(n);bit=0
    for ch in data:
        v=ALPHA.index(ch)
        for b in range(6):
            if v>>b&1 and bit+b<n*8: out[(bit+b)>>3]|=1<<((bit+b)&7)
        bit+=6
        if bit>=n*8:break
    return bytes(out)
def juce_encode(b):
    n=len(b);bits=n*8;out=[]
    for i in range(0,bits,6):
        v=0
        for k in range(6):
            j=i+k
            if j<bits and b[j>>3]>>(j&7)&1: v|=1<<k
        out.append(ALPHA[v])
    return f"{n}."+''.join(out)
def get_component(raw):
    x=raw[8:].decode('utf-8');a=x.index('<IComponent>')+12;b=x.index('</IComponent>')
    return juce_decode(x[a:b]),x,a,b
def with_component(raw,comp):
    _,x,a,b=get_component(raw)
    xml=(x[:a]+juce_encode(comp)+x[b:]).encode('utf-8')
    n=len(xml)-1 if xml.endswith(b'\x00') else len(xml)  # 长度字段不含末尾的 \0
    return raw[:4]+struct.pack('<I',n)+xml
