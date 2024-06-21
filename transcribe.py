import whisper
import sys
import ssl
ssl._create_default_https_context = ssl._create_unverified_context
def transcribe_audio(audio_path):
    model = whisper.load_model("tiny")
    result = model.transcribe(audio_path)
    print(result['text'])

if __name__ == "__main__":
    audio_path = sys.argv[1]
    transcribe_audio(audio_path)