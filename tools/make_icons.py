"""Genereerib app'i ikoonid (ainult standardteek): 2x2 ruudustik roheline/punane/kollane/roheline."""
import struct, zlib, sys, os
def png(path, size):
    bg=(31,41,51); cols=[(46,157,79),(211,58,44),(242,194,48),(46,157,79)]
    m=size*0.14; g=size*0.06; t=(size-2*m-g)/2; r=t*0.18
    rows=[]
    for y in range(size):
        row=bytearray([0])
        for x in range(size):
            c=bg
            for i in range(4):
                x0=m+(i%2)*(t+g); y0=m+(i//2)*(t+g)
                dx=max(x0+r-x,0,x-(x0+t-r)); dy=max(y0+r-y,0,y-(y0+t-r))
                if x0<=x<x0+t and y0<=y<y0+t and dx*dx+dy*dy<=r*r: c=cols[i]
            row+=bytes(c)
        rows.append(bytes(row))
    raw=zlib.compress(b''.join(rows),9)
    def ch(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    open(path,'wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+ch(b'IDAT',raw)+ch(b'IEND',b''))
out=sys.argv[1]
for s in (180,192,512): png(os.path.join(out,'icon-%d.png'%s),s)
