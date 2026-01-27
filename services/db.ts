import { Job } from "../types";

const DB_NAME = "TranscriptorPro_V4";
const DB_VERSION = 1;

export const dbService = {
    instance: null as IDBDatabase | null,
    
    init: async (): Promise<void> => {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
                const d = (e.target as IDBOpenDBRequest).result;
                if (!d.objectStoreNames.contains('jobs')) d.createObjectStore('jobs', { keyPath: 'id' });
                if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
            };
            req.onsuccess = (e: Event) => {
                dbService.instance = (e.target as IDBOpenDBRequest).result;
                resolve();
            };
            req.onerror = reject;
        });
    },

    saveJob: (job: Partial<Job>) => {
        if (!dbService.instance) return;
        // Strip non-clonable fields if any
        const { abortController, resumeResolve, ...clonableJob } = job;
        const tx = dbService.instance.transaction(['jobs'], 'readwrite');
        tx.objectStore('jobs').put(clonableJob);
    },

    getJobs: async (): Promise<Job[]> => {
        if (!dbService.instance) return [];
        return new Promise(resolve => {
            const tx = dbService.instance!.transaction(['jobs'], 'readonly');
            const req = tx.objectStore('jobs').getAll();
            req.onsuccess = () => resolve(req.result);
        });
    },

    saveSetting: (k: string, v: any) => {
        if (!dbService.instance) return;
        const tx = dbService.instance.transaction(['settings'], 'readwrite');
        tx.objectStore('settings').put({ key: k, value: v });
    },

    getSetting: async (k: string): Promise<any> => {
        if (!dbService.instance) return null;
        return new Promise(resolve => {
            const tx = dbService.instance!.transaction(['settings'], 'readonly');
            const req = tx.objectStore('settings').get(k);
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
        });
    }
};