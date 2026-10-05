import numpy as np, sys, os
from scipy.io import wavfile
from scipy.signal import lfilter, resample_poly, butter, sosfilt
HERE=os.path.dirname(os.path.abspath(__file__)); SR=48000
sr,x=wavfile.read(os.path.join(HERE,sys.argv[1] if len(sys.argv)>1 else "hero-score.wav")); x=x.astype(np.float64)
def kw(x):
  b1=[1.53512485958697,-2.69169618940638,1.19839281085285];a1=[1,-1.69065929318241,0.73248077421585]
  b2=[1,-2,1];a2=[1,-1.99004745483398,0.99007225036621]
  return lfilter(b2,a2,lfilter(b1,a1,x,axis=0),axis=0)
k=kw(x); W=int(0.4*SR); H=int(0.1*SR)
def lufs(seg): return -0.691+10*np.log10(np.sum(np.mean(seg**2,0))+1e-20)
tp=np.abs(resample_poly(x,4,1,axis=0))
bands=[(None,80),(80,300),(300,2500),(2500,None)]
def bf(lo,hi):
  s=butter(4,[lo,hi],"band",fs=SR,output="sos") if lo and hi else (butter(4,hi,"low",fs=SR,output="sos") if hi else butter(4,lo,"high",fs=SR,output="sos"))
  return sosfilt(s,x.mean(1))
B=[bf(*b) for b in bands]
print(" t     M-LUFS  TPdB   sub  low  mid  hi   corr  S/M")
for i in range(0,len(x)-W,H):
  seg=x[i:i+W]; m=(seg[:,0]+seg[:,1])/2; s=(seg[:,0]-seg[:,1])/2
  c=np.corrcoef(seg[:,0],seg[:,1])[0,1] if seg.std()>1e-6 else 0
  bl=[10*np.log10(np.mean(b[i:i+W]**2)+1e-20) for b in B]
  print(f"{(i+W/2)/SR:5.2f} {lufs(k[i:i+W]):7.1f} {20*np.log10(tp[4*i:4*(i+W)].max()+1e-12):5.1f} "+" ".join(f"{v:4.0f}" for v in bl)+f"  {c:5.2f} {10*np.log10(np.mean(s**2)+1e-20)-10*np.log10(np.mean(m**2)+1e-20):5.1f}")
# gated integrated over film part
blocks=[lufs(k[i:i+W]) for i in range(0,int(7.92*SR)-W,H)]
bl=np.array(blocks); g=bl[bl>-70]; I=-0.691+10*np.log10(np.mean(10**((g+0.691)/10))); g2=g[g>I-10]
I=-0.691+10*np.log10(np.mean(10**((g2+0.691)/10)))
print("integrated(film 0-7.92) %.1f LUFS; true peak %.1f dBTP; void 7.93-8.45 max %.1f dBFS"%(I,20*np.log10(tp.max()),20*np.log10(np.abs(x[int(7.93*SR):int(8.45*SR)]).max()+1e-12)))
