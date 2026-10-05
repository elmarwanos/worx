import numpy as np, glob, os, sys
from scipy.io import wavfile
from scipy.signal import welch, butter, sosfilt, find_peaks
SR=48000
def band(x,lo,hi): return 10*np.log10(np.mean(sosfilt(butter(4,[lo,hi],"band",fs=SR,output="sos"),x)**2)+1e-20)
for f in sorted(glob.glob(sys.argv[1] if len(sys.argv)>1 else "src/*.wav")):
    sr,x=wavfile.read(f); x=x.astype(float); m=x.mean(1); d=len(m)/SR
    rms=20*np.log10(np.sqrt(np.mean(m**2))+1e-12)
    # stationarity: 1 s RMS spread
    w=SR; seg=[20*np.log10(np.sqrt(np.mean(m[i:i+w]**2))+1e-12) for i in range(0,len(m)-w,w//2)]
    seg=np.array(seg); act=seg[seg>seg.max()-40]
    fr,P=welch(m,SR,nperseg=SR*2); sel=(fr>20)&(fr<400)
    pk,_=find_peaks(10*np.log10(P[sel]+1e-20),prominence=8); pf=fr[sel][pk]; pp=10*np.log10(P[sel][pk])
    top=pf[np.argsort(pp)[::-1][:4]]
    cen=np.sum(fr*P)/np.sum(P)
    c=np.corrcoef(x[:,0],x[:,1])[0,1]
    print(f"{os.path.basename(f)[:40]:40s} {d:6.1f}s rms{rms:6.1f} spread(p10-p90) {np.percentile(act,90)-np.percentile(act,10):4.1f}dB cen{cen:6.0f}Hz  sub<60 {band(m,20,60):5.0f} low60-250 {band(m,60,250):5.0f} mid250-2k {band(m,250,2000):5.0f} hi2k+ {band(m,2000,12000):5.0f} corr{c:5.2f} peaks{np.round(top,1)}")
