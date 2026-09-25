from pathlib import Path
import subprocess
from pypdf import PdfReader
from PIL import Image,ImageOps,ImageDraw
out=Path('tmp/pdfs/qa'); out.mkdir(exist_ok=True)
pop=r'C:\Users\HP\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe'
files=sorted(Path('planificaciones/Entrega_Clase04_2026-09-20').glob('Virtus_*.pdf'))
for f in files:
    subprocess.run([pop,'-scale-to','1100','-png',str(f),str(out/f.stem)],capture_output=True,check=True)
    r=PdfReader(f)
    text=''.join(p.extract_text() for p in r.pages)
    assert all(x in text for x in ['DATOS INFORMATIVOS','PLANIFICACIÓN','ADAPTACIONES CURRICULARES','HORAS DE ACOMPAÑAMIENTO'])
    assert all(tuple(p.mediabox)==(0,0,612,792) for p in r.pages)
    print(f.name,len(r.pages))
    imgs=[ImageOps.contain(Image.open(p),(425,550)) for p in sorted(out.glob(f.stem+'-*.png'))]
    sheet=Image.new('RGB',(len(imgs)*430,585),'#cccccc')
    for i,im in enumerate(imgs): sheet.paste(im,(i*430,25))
    ImageDraw.Draw(sheet).text((5,5),f.stem,fill='black')
    sheet.save(out/(f.stem+'.jpg'))
