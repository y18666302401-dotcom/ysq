import os
HERE=os.path.dirname(os.path.abspath(__file__))
import json, wave, numpy as np, scipy.signal as ss
SR=48000; DUR=10.0; N=int(SR*DUR); t=np.arange(N)/SR; rng=np.random.default_rng(3)
tc=json.load(open(os.path.join(HERE,'sim.json')))['tCatch']
db=lambda d:10**(d/20)
def lp(x,f): b,a=ss.butter(2,f/(SR/2)); return ss.lfilter(b,a,x)
def hp(x,f): b,a=ss.butter(2,f/(SR/2),'high'); return ss.lfilter(b,a,x)
def bp(x,f1,f2): b,a=ss.butter(2,[f1/(SR/2),f2/(SR/2)],'band'); return ss.lfilter(b,a,x)
def env(a,b,fi,fo):
    e=np.clip((t-a)/fi,0,1)*np.clip((b-t)/fo,0,1); return e
def pad(freqs,e,g):
    x=sum(np.sin(2*np.pi*f*t*(1+0.002*np.sin(2*np.pi*0.2*t+k))+k)+0.2*np.sin(4*np.pi*f*t+k) for k,f in enumerate(freqs))/len(freqs); return x*e*db(g)
out=np.zeros(N)
out+=pad([73.4,110,146.8,174.6,220],env(0,5.6,1.0,1.2),-20)        # 夜：D小调
out+=pad([87.3,130.8,174.6,220,261.6],env(5.0,10,1.2,0.8),-22)      # 白天：F大调
out+=lp(rng.standard_normal(N),400)*db(-34)*env(0,5.5,0.8,1.0)      # 夜风
def add(x,at,g):
    i=int(at*SR); n=min(len(x),N-i); out[i:i+n]+=x[:n]*db(g)
def liquid(d):  # 液体流动：带通噪声 + 低频起伏的“咕嘟”
    n=int(d*SR); tt=np.arange(n)/SR; x=rng.standard_normal(n); y=np.zeros(n); cs=int(0.04*SR)
    for i in range(0,n,cs):
        f=300+250*np.sin(i/SR*9)+200*rng.random(); seg=bp(x[max(0,i-2000):i+cs],f*0.7,f*1.4); y[i:i+cs]=seg[-len(y[i:i+cs]):]
    blub=sum(np.sin(2*np.pi*(180+60*k)*tt*(1+0.5*np.exp(-((tt-k*d/5)%0.3)*20)))*np.exp(-((tt-k*d/5)%0.3)*25) for k in range(5))*0.25
    return (y*2+blub)*np.sin(np.linspace(0,np.pi,n))
def tick(): n=int(0.025*SR); return hp(rng.standard_normal(n)*np.exp(-np.arange(n)/120),2500)
def clink():
    n=int(0.6*SR); tt=np.arange(n)/SR; return sum(np.sin(2*np.pi*f*tt)*np.exp(-tt*k) for f,k in [(2300,9),(3700,12),(5200,16)])/3+hp(rng.standard_normal(n),3000)*np.exp(-tt*60)*0.5
def thud(): n=int(0.4*SR); tt=np.arange(n)/SR; return np.sin(2*np.pi*90*tt*(1+np.exp(-tt*10)))*np.exp(-tt*9)
add(liquid(1.9),1.05,-14); add(liquid(1.7),4.3,-18); add(liquid(1.5),5.9,-15); add(liquid(0.9),7.0,-20)
add(thud(),2.9,-16)
if tc: add(clink(),tc,-12); add(thud(),tc,-14)
for k in np.arange(3.2,5.2,0.06): add(tick(),k,-24)                    # 指针倒转
for k in np.arange(5.4,10,0.5): add(tick(),k,-30)
for k in np.arange(7.5,9.9,0.21):                                       # 铅笔沙沙
    n=int(0.16*SR); add(bp(rng.standard_normal(n),2500,6000)*np.sin(np.linspace(0,np.pi,n)),k+0.03*np.sin(k*7),-30)
out*=db(-3)/max(1e-9,np.abs(out).max())
o=(out*32767).astype(np.int16); w=wave.open(os.path.join(HERE,'sound.wav'),'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(np.stack([o,o],1).tobytes()); w.close()
print('peak dBFS', round(20*np.log10(np.abs(out).max()),1))
