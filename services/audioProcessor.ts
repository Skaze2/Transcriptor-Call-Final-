import { AudioSegment, Job } from "../types";

const API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const CHUNK_DURATION = 600; // 10 minutes

export const processor = {
    decodeRaw: async (file: File) => {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const ab = await file.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(ab);

        const leftRaw = processor.downsampleBuffer(audioBuf.getChannelData(0), audioBuf.sampleRate, 16000);
        const rightRaw = audioBuf.numberOfChannels >= 2
            ? processor.downsampleBuffer(audioBuf.getChannelData(1), audioBuf.sampleRate, 16000)
            : leftRaw;

        return { leftRaw, rightRaw, sampleRate: 16000 };
    },

    downsampleBuffer: (buffer: Float32Array, sampleRate: number, outSampleRate: number) => {
        if (outSampleRate === sampleRate) return buffer;
        if (outSampleRate > sampleRate) return buffer;
        const ratio = sampleRate / outSampleRate;
        const newLength = Math.round(buffer.length / ratio);
        const result = new Float32Array(newLength);
        for (let i = 0; i < newLength; i++) {
            result[i] = buffer[Math.round(i * ratio)];
        }
        return result;
    },

    createWavBlob: (samples: Float32Array, sampleRate: number) => {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);
        const GAIN = 2.0;

        const writeString = (view: DataView, offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);

        let offset = 44;
        for (let i = 0; i < samples.length; i++) {
            let s = samples[i] * GAIN;
            s = Math.max(-1, Math.min(1, s));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }
        return new Blob([view], { type: 'audio/wav' });
    },

    assignRolesByEnergy: (segments: AudioSegment[], leftRaw: Float32Array, rightRaw: Float32Array, sampleRate: number) => {
        return segments.map(seg => {
            const startIdx = Math.floor(seg.start * sampleRate);
            const endIdx = Math.floor(seg.end * sampleRate);

            let sumL = 0, sumR = 0;
            const step = 50;
            for (let i = startIdx; i < endIdx && i < leftRaw.length; i += step) {
                sumL += Math.abs(leftRaw[i]);
                sumR += Math.abs(rightRaw[i]);
            }

            // Simple heuristic: If Right channel has 10% more energy, it's Cliente (assuming stereo setup)
            let role = "Asesor";
            if ((sumR * 1.1) > sumL) {
                role = "Cliente";
            }
            return { ...seg, role: role };
        });
    },

    generateDocBlob: (segments: AudioSegment[], filename: string) => {
        let mergedSegments: AudioSegment[] = [];
        if (segments.length > 0) {
            let currentBlock = { role: segments[0].role, text: segments[0].text, start: segments[0].start, end: segments[0].end };
            for (let i = 1; i < segments.length; i++) {
                const s = segments[i];
                if (s.role === currentBlock.role) {
                    currentBlock.text += " " + s.text;
                    currentBlock.end = s.end;
                } else {
                    mergedSegments.push(currentBlock);
                    currentBlock = { role: s.role, text: s.text, start: s.start, end: s.end };
                }
            }
            mergedSegments.push(currentBlock);
        }

        let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>
            body { font-family: 'Calibri', Arial, sans-serif; padding: 20px; font-size: 11pt; }
            .dialogue-block { margin-bottom: 15px; }
            .role-asesor { color: #0056b3; font-weight: bold; font-size: 0.9em; text-transform: uppercase; }
            .role-cliente { color: #d35400; font-weight: bold; font-size: 0.9em; text-transform: uppercase; }
            .timestamp { color: #666; font-size: 0.8em; font-family: monospace; margin-right: 5px; }
        </style></head><body>
        <h2 style="color:#333; border-bottom:1px solid #ccc;">Transcripción: ${filename}</h2>`;

        mergedSegments.forEach(s => {
            const timeStr = new Date(s.start * 1000).toISOString().substr(11, 8);
            const roleClass = s.role === 'Asesor' ? 'role-asesor' : 'role-cliente';
            const roleName = s.role === 'Asesor' ? 'ASESOR' : 'CLIENTE';

            html += `<div class="dialogue-block">
                        <span class="timestamp">[${timeStr}]</span> <span class="${roleClass}">${roleName}:</span> 
                        <span>${s.text}</span>
                     </div>`;
        });

        html += "</body></html>";
        return new Blob(['\ufeff', html], { type: 'application/msword' });
    },

    transcribeApiCall: async (blob: Blob, key: string, modelName: string, signal?: AbortSignal) => {
        const fd = new FormData();
        fd.append("file", blob, "audio.wav");
        fd.append("model", modelName);
        fd.append("response_format", "verbose_json");
        fd.append("prompt", "PIMO TV, Tian Rodríguez, Jesús Benavides, marketing, ventas.");

        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Authorization": `Bearer ${key}` },
            body: fd,
            signal: signal
        });

        if (!res.ok) {
            let errorMsg = `Error ${res.status}`;
            try {
                const json = await res.json();
                if (json.error) errorMsg += `: ${json.error.message}`;
            } catch (e) { }
            throw new Error(errorMsg);
        }
        const json = await res.json();
        return json.segments || [];
    }
};