"""Render captured public UI frames with locally generated narration. Requires imageio-ffmpeg."""
import json,subprocess,wave
from pathlib import Path
import imageio_ffmpeg
root=Path(__file__).resolve().parents[2]
work=Path('/tmp/teampay-video')
scenes=json.loads((root/'submission/demo/scenes.json').read_text())
with wave.open(str(work/'narration.wav'),'wb') as output:
 output.setnchannels(1);output.setsampwidth(2);output.setframerate(24000)
 for i,scene in enumerate(scenes):
  with wave.open(str(work/f'voice-{i}.wav'),'rb') as voice:
   assert voice.getframerate()==24000 and voice.getnchannels()==1 and voice.getsampwidth()==2
   frames=voice.getnframes();output.writeframes(voice.readframes(frames))
   output.writeframes(b'\0\0'*(round(scene['duration']*24000)-frames))
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
duration=sum(s['duration'] for s in scenes)
subprocess.run([ffmpeg,'-hide_banner','-y','-framerate','8','-i',str(work/'frames/%05d.jpg'),'-i',str(work/'narration.wav'),'-vf',f'fps=24,fade=t=in:st=0:d=0.25,fade=t=out:st={duration-0.4}:d=0.4','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-c:v','libx264','-preset','medium','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-ar','48000','-movflags','+faststart','-shortest',str(root/'dist/demo/teampay-demo.mp4')],check=True)
