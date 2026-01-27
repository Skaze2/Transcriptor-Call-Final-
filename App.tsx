import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgentConfig, Job, UserRole } from './types';
import { db, ref, onValue, set, update, runTransaction, push } from './services/firebase';
import { dbService } from './services/db';
import { processor } from './services/audioProcessor';
import LoginOverlay from './components/LoginOverlay';
import Sidebar from './components/Sidebar';
import AdminPanel from './components/AdminPanel';
import Dashboard from './components/Dashboard';

const SECONDS_PER_DAY = 28800; // 8 Hours

const App: React.FC = () => {
  // Config & Auth State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [agentConfig, setAgentConfig] = useState<Record<string, AgentConfig>>({});
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // App State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [keyOwners, setKeyOwners] = useState<Record<string, string>>({});
  const [keyLocks, setKeyLocks] = useState<Record<string, boolean>>({});
  const [keyUsage, setKeyUsage] = useState<Record<string, number>>({});
  
  // Admin Test Mode State
  const [adminTestKeys, setAdminTestKeys] = useState<Record<string, boolean>>({});

  // Processing State
  const [maxConcurrency, setMaxConcurrency] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalPaused, setGlobalPaused] = useState(false);
  const [currentKeyIndex, setCurrentKeyIndex] = useState(0);
  const [selectedModel, setSelectedModel] = useState('whisper-large-v3');

  // Refs for processing loop
  const jobsRef = useRef<Job[]>([]);
  jobsRef.current = jobs;
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;
  const globalPausedRef = useRef(globalPaused);
  globalPausedRef.current = globalPaused;
  const keysRef = useRef<string[]>(keys);
  keysRef.current = keys;
  const keyLocksRef = useRef<Record<string, boolean>>(keyLocks);
  keyLocksRef.current = keyLocks;
  const keyOwnersRef = useRef<Record<string, string>>(keyOwners);
  keyOwnersRef.current = keyOwners;
  const adminTestKeysRef = useRef<Record<string, boolean>>(adminTestKeys);
  adminTestKeysRef.current = adminTestKeys;
  const currentKeyIndexRef = useRef(currentKeyIndex);
  currentKeyIndexRef.current = currentKeyIndex;
  const userRoleRef = useRef<UserRole>(userRole);
  userRoleRef.current = userRole;

  // --- INITIALIZATION ---
  useEffect(() => {
    dbService.init().then(() => {
        loadJobs();
    });

    // Theme init
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light';
    if(savedTheme) toggleTheme(savedTheme);

    // Load locks
    const savedLocks = localStorage.getItem('groqKeyLocks');
    if(savedLocks) setKeyLocks(JSON.parse(savedLocks));

    // Firebase listeners
    const configRef = ref(db, 'agent_config');
    onValue(configRef, (snapshot) => {
        const data = snapshot.val();
        if(data) {
            setAgentConfig(data);
        } else {
            // Seed defaults if empty
             const defaults: Record<string, any> = {
                 'ADMIN': { id: 'ADMIN', name: 'ADMIN', pin: '9811', keys: '' }
             };
             for(let i=1; i<=6; i++) {
                 defaults[`100${i}`] = { id: `100${i}`, name: `Agente ${i}`, pin: `100${i}`, keys: "" };
             }
             set(configRef, defaults);
        }
    });

    // Date check interval for resetting local state if day changes
    const checkDateInterval = setInterval(() => {
        // Simple logic: if day changes, we might want to refresh stats or archive jobs
        // Original logic reloads jobs on new day.
    }, 60000);

    return () => clearInterval(checkDateInterval);
  }, []);

  // --- LISTENERS FOR STATS ---
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const keyStatsRef = ref(db, `daily_key_stats/${todayStr}`);
    const unsub = onValue(keyStatsRef, (snapshot) => {
        setKeyUsage(snapshot.val() || {});
    });
    return () => unsub();
  }, []); // Should ideally re-run on date change

  // --- AUTO REFRESH KEYS WHEN CONFIG CHANGES ---
  useEffect(() => {
    // Determine if we need to reload keys based on current role and new config
    if (currentUser && userRole) {
         // Re-run key loading logic without full login
         const newKeys: string[] = [];
         const newKeyOwners: Record<string, string> = {};

         if (userRole === 'admin') {
             // Admin sees ALL keys
             (Object.values(agentConfig) as AgentConfig[]).forEach((agent) => {
                 const k = agent.keys.split('\n').map(x => x.trim()).filter(x => x.length > 5);
                 k.forEach(key => {
                     newKeys.push(key);
                     newKeyOwners[key] = agent.name;
                 });
             });
         } else {
             // Agent sees ONLY their keys
             // Find current agent ID by name (inefficient but safe) or we need to store ID in state
             // Assuming currentUser is the name. Let's find the config.
             const agent = (Object.values(agentConfig) as AgentConfig[]).find((a) => a.name === currentUser);
             if (agent) {
                 const k = agent.keys.split('\n').map(x => x.trim()).filter(x => x.length > 5);
                 k.forEach(key => newKeys.push(key));
             }
         }
         
         // Only update if changed (basic length check or simply update)
         setKeys(newKeys);
         setKeyOwners(newKeyOwners);
    }
  }, [agentConfig, currentUser, userRole]);


  const loadJobs = async () => {
    let allJobs = await dbService.getJobs();
    setJobs(allJobs);
  };

  const toggleTheme = (force?: 'dark'|'light') => {
      const next = force || (theme === 'dark' ? 'light' : 'dark');
      setTheme(next);
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
  };

  const handleLogin = (role: UserRole, username: string, userId?: string) => {
      setUserRole(role);
      setCurrentUser(username);
      
      // Load Keys based on role
      const newKeys: string[] = [];
      const newKeyOwners: Record<string, string> = {};

      if (role === 'admin') {
          // Admin loads EVERYTHING (Visible in Sidebar)
          (Object.values(agentConfig) as AgentConfig[]).forEach((agent) => {
              const k = agent.keys.split('\n').map(x => x.trim()).filter(x => x.length > 5);
              k.forEach(key => {
                  newKeys.push(key);
                  newKeyOwners[key] = agent.name; // This will map 'ADMIN' keys to 'ADMIN' name
              });
          });
      } else if (userId && agentConfig[userId]) {
          // Agent loads ONLY their keys
          const k = agentConfig[userId].keys.split('\n').map(x => x.trim()).filter(x => x.length > 5);
          k.forEach(key => newKeys.push(key));
      }

      setKeys(newKeys);
      setKeyOwners(newKeyOwners);
      setAdminTestKeys({}); // Reset test mode on login
  };

  const handleLogout = () => {
      setCurrentUser(null);
      setUserRole(null);
      setIsAdminPanelOpen(false);
      setKeys([]);
      setKeyOwners({});
      setAdminTestKeys({}); // Reset test selection
  };

  const updateJobsState = (id: string, updates: Partial<Job>) => {
      setJobs(prev => {
          const next = prev.map(j => j.id === id ? { ...j, ...updates } : j);
          return next;
      });
      // Also update DB (non-blocking)
      const job = jobsRef.current.find(j => j.id === id);
      if(job) dbService.saveJob({ ...job, ...updates });
  };

  // --- PROCESSING ENGINE ---

  const getNextKey = () => {
      const kList = keysRef.current; // This contains all keys available to role
      const owners = keyOwnersRef.current;
      const locks = keyLocksRef.current;
      const role = userRoleRef.current;
      const adminTests = adminTestKeysRef.current;

      if (kList.length === 0) return null;
      
      // 1. DETERMINE POOL
      let pool: string[] = [];

      if (role === 'admin') {
          const activeTestKeys = kList.filter(k => adminTests[k] === true);
          if (activeTestKeys.length > 0) {
              pool = activeTestKeys; // Use Selected Test Keys
          } else {
              pool = kList.filter(k => owners[k] === 'ADMIN'); // Use Admin's Keys
          }
      } else {
          pool = kList; // Use Agent's Keys
      }

      if (pool.length === 0) return null;

      // 2. SORT POOL FOR CONSISTENT ROTATION
      // Sort the pool based on their original index in the master kList.
      // This ensures the rotation always follows the visual order (Top to Bottom).
      pool.sort((a, b) => kList.indexOf(a) - kList.indexOf(b));

      // 3. ROUND ROBIN SELECTION
      // We iterate through the pool starting from the current offset.
      const offset = currentKeyIndexRef.current; 
      
      for (let i = 0; i < pool.length; i++) {
          // Use modulo to wrap around the pool
          const idx = (offset + i) % pool.length;
          const k = pool[idx];

          if (!locks[k]) {
              // FOUND UNLOCKED KEY
              
              // 4. UPDATE COUNTER FOR NEXT CALL
              const nextIndex = offset + i + 1;
              setCurrentKeyIndex(nextIndex);
              currentKeyIndexRef.current = nextIndex;

              // 5. CALCULATE VISUAL DISPLAY ID (RELATIVE TO OWNER)
              const ownerName = owners[k];
              
              // Filter master list to get only keys for this owner
              // We assume the Sidebar renders them in the same order as kList
              const ownerKeys = kList.filter(keyItem => owners[keyItem] === ownerName);
              
              // The visual ID is the index in the owner's specific list + 1
              const visualId = ownerKeys.indexOf(k) + 1;

              return { key: k, id: visualId, owner: ownerName };
          }
      }

      return null;
  };

  const processQueue = useCallback(() => {
      if (globalPausedRef.current) return;
      
      const activeCount = jobsRef.current.filter(f => f.status === 'active').length;
      const slotsAvailable = maxConcurrency - activeCount;

      if (slotsAvailable > 0) {
          const pending = jobsRef.current.filter(f => f.status === 'pending');
          const toStart = pending.slice(0, slotsAvailable);
          toStart.forEach(job => runSingleJob(job));
      }
  }, [maxConcurrency]);

  // Trigger processQueue whenever jobs or concurrency changes
  useEffect(() => {
      if(isProcessing) processQueue();
  }, [jobs, maxConcurrency, isProcessing, processQueue]);

  const runSingleJob = async (job: Job) => {
      if (job.status === 'cancelled') return;
      
      const keyObj = getNextKey();
      if(!keyObj) {
          updateJobsState(job.id, { status: 'error', statusText: 'Sin llaves disponibles/activas' });
          return;
      }

      updateJobsState(job.id, { 
          status: 'active', 
          assignedKey: keyObj,
          progress: 5,
          progressStep: 'decoding',
          statusText: 'Iniciando...'
      });

      // Define runtime controllers
      const abortController = new AbortController();
      let resumeResolve: ((value: void | PromiseLike<void>) => void) | null = null;
      
      // Update job in state with controllers (not DB)
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, abortController } : j));
      
      // Needed to update refs for checkPause
      const checkPause = async () => {
          const currentJob = jobsRef.current.find(j => j.id === job.id);
          if (!currentJob) return; // Removed?
          if (currentJob.status === 'cancelled') throw new Error("CANCEL_SIGNAL");
          
          if (currentJob.paused) {
              await new Promise<void>(r => { 
                  // Find job in current state to attach resolve
                  setJobs(prev => prev.map(j => j.id === job.id ? { ...j, resumeResolve: r } : j));
              });
          }
           // Re-check after resume
           const postResumeJob = jobsRef.current.find(j => j.id === job.id);
           if (postResumeJob?.status === 'cancelled') throw new Error("CANCEL_SIGNAL");
      };

      try {
          // 1. Decode
          if (!job.file) throw new Error("File object lost");
          await checkPause();
          updateJobsState(job.id, { progress: 5, statusText: 'Decodificando...' });
          
          const { leftRaw, rightRaw, sampleRate } = await processor.decodeRaw(job.file);
          
          // 2. Mix
          await checkPause();
          updateJobsState(job.id, { progress: 15, statusText: 'Unificando canales...' });
          const mixedMono = new Float32Array(leftRaw.length);
          for(let i=0; i<leftRaw.length; i++) mixedMono[i] = (leftRaw[i] + rightRaw[i]) * 0.5;

          // 3. Chunk & Transcribe
          const chunkSamples = 600 * sampleRate; // 600s = 10min
          const totalSamples = mixedMono.length;
          const totalChunks = Math.ceil(totalSamples / chunkSamples);
          let allSegments: any[] = [];

          for (let i = 0; i < totalSamples; i += chunkSamples) {
              const chunkIndex = Math.floor(i / chunkSamples) + 1;
              const pct = 25 + Math.round((chunkIndex / totalChunks) * 60);
              updateJobsState(job.id, { progress: pct, statusText: `Transcribiendo parte ${chunkIndex}/${totalChunks}...` });

              const end = Math.min(i + chunkSamples, totalSamples);
              const chunkSlice = mixedMono.subarray(i, end);
              const wavBlob = processor.createWavBlob(chunkSlice, sampleRate);
              const duration = chunkSlice.length / sampleRate;

              // API Call with Retry
              const executeWithRetry = async () => {
                  let attempts = 0;
                  const maxAttempts = keysRef.current.length * 2; // Rough upper bound
                  let currentAssignedKey = keyObj; 

                  while(attempts < maxAttempts) {
                       try {
                           const segments = await processor.transcribeApiCall(wavBlob, currentAssignedKey.key, selectedModel, abortController.signal);
                           // Record usage
                           const todayStr = new Date().toISOString().split('T')[0];
                           const safeKey = currentAssignedKey.key.replace(/[.#$\[\]]/g, "_");
                           
                           // Firebase increment
                           const updates: any = {};
                           // Better to use transaction for user stats
                           const userRef = ref(db, `daily_stats/${todayStr}/${currentUser}`);
                           runTransaction(userRef, (current) => (current || 0) + duration);

                           const keyRef = ref(db, `daily_key_stats/${todayStr}/${safeKey}`);
                           runTransaction(keyRef, (current) => (current || 0) + duration);
                           
                           return segments;

                       } catch(error: any) {
                           if (error.message.includes("429") || error.message.includes("401") || error.message.includes("TIMEOUT")) {
                               // RE-FETCH KEY ON FAILURE
                               const nextKey = getNextKey();
                               if(!nextKey) throw new Error("Sin llaves disponibles");
                               currentAssignedKey = nextKey;
                               updateJobsState(job.id, { assignedKey: nextKey });
                               attempts++;
                               await new Promise(r => setTimeout(r, 1000));
                           } else {
                               throw error;
                           }
                       }
                  }
                  throw new Error("Rate Limit Exhausted");
              };

              const segments = await executeWithRetry();

              const timeOffset = i / sampleRate;
              const adjustedSegments = segments.map((s: any) => ({
                    start: s.start + timeOffset,
                    end: s.end + timeOffset,
                    text: s.text.trim()
              }));
              allSegments = allSegments.concat(adjustedSegments);
          }

          // 4. Diarization
          updateJobsState(job.id, { progress: 85, statusText: 'Identificando hablantes...' });
          const labeledSegments = processor.assignRolesByEnergy(allSegments, leftRaw, rightRaw, sampleRate);

          // 5. Generate Doc
          updateJobsState(job.id, { progress: 90, statusText: 'Generando DOC...' });
          const docBlob = processor.generateDocBlob(labeledSegments, job.fileName);
          
          // 6. Finish
          const durationTotal = totalSamples / sampleRate;
          const todayStr = new Date().toISOString().split('T')[0];
          
          // Log history to Firebase
          push(ref(db, `history/${todayStr}`), {
              agent: currentUser,
              filename: job.fileName,
              duration: durationTotal,
              timestamp: Date.now()
          });

          updateJobsState(job.id, {
              status: 'done',
              progress: 100,
              statusText: 'Finalizado',
              docBlob: docBlob,
              file: undefined // Clear file from memory
          });

      } catch (error: any) {
          if (error.message === 'CANCEL_SIGNAL') return;
          console.error(error);
          updateJobsState(job.id, { status: 'error', statusText: error.message.substring(0, 100) });
      }
  };


  // --- UI ACTIONS ---

  const handleStartAll = () => {
      setIsProcessing(true);
      setGlobalPaused(false);
      globalPausedRef.current = false;
      // Trigger effect via state change
  };

  const handlePauseAll = () => {
      const nextState = !globalPaused;
      setGlobalPaused(nextState);
      globalPausedRef.current = nextState;
      
      // Update individual jobs
      jobs.forEach(j => {
          if(j.status === 'active') {
              updateJobsState(j.id, { paused: nextState });
              if(!nextState && j.resumeResolve) {
                  j.resumeResolve();
                  setJobs(prev => prev.map(p => p.id === j.id ? { ...p, resumeResolve: undefined } : p));
              }
          }
      });
      if(!nextState) processQueue();
  };

  const handleFilesAdded = (files: FileList) => {
      const newJobs: Job[] = Array.from(files).map(file => ({
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          file: file,
          fileName: file.name,
          fileSize: file.size,
          timestamp: Date.now(),
          status: 'pending',
          paused: false,
          downloaded: false,
          agent: currentUser || 'Unknown'
      }));
      setJobs(prev => {
          const combined = [...prev, ...newJobs];
          newJobs.forEach(j => dbService.saveJob(j));
          return combined;
      });
  };

  const handleCancelJob = (id: string) => {
      const job = jobs.find(j => j.id === id);
      if(job) {
          if(job.abortController) job.abortController.abort();
          if(job.resumeResolve) job.resumeResolve();
          updateJobsState(id, { status: 'cancelled', statusText: 'Cancelado' });
      }
  };

  const handleRetryJob = (id: string) => {
      const job = jobs.find(j => j.id === id);
      if(!job) return;
      
      // Reset job
      updateJobsState(id, { 
          status: 'pending', 
          paused: false, 
          assignedKey: undefined,
          progress: 0,
          statusText: 'Reintentando...',
          abortController: undefined
      });
      
      setIsProcessing(true); // Ensure engine is on
  };

  const toggleLock = (key: string) => {
      const newLocks = { ...keyLocks, [key]: !keyLocks[key] };
      setKeyLocks(newLocks);
      localStorage.setItem('groqKeyLocks', JSON.stringify(newLocks));
  };

  const toggleAdminTestKey = (key: string) => {
      setAdminTestKeys(prev => ({
          ...prev,
          [key]: !prev[key]
      }));
  };

  if (!currentUser) {
      return (
          <div className="h-screen w-screen bg-bg-body text-text-main">
            <LoginOverlay 
                agentConfig={agentConfig} 
                onLogin={handleLogin} 
            />
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-bg-body text-text-main overflow-hidden">
        {/* Admin Panel Overlay */}
        {isAdminPanelOpen && (
            <AdminPanel 
                agentConfig={agentConfig} 
                onClose={() => setIsAdminPanelOpen(false)}
                onLogout={handleLogout}
            />
        )}

        {/* Sidebar */}
        <Sidebar 
            keys={keys}
            keyUsage={keyUsage}
            keyLocks={keyLocks}
            keyOwners={keyOwners}
            onToggleLock={toggleLock}
            isAdmin={userRole === 'admin'}
            adminTestKeys={adminTestKeys}
            onToggleTestKey={toggleAdminTestKey}
        />

        {/* Main Content */}
        <main className="flex-1 p-10 overflow-y-auto">
            <Dashboard 
                userRole={userRole}
                currentUser={currentUser}
                theme={theme}
                toggleTheme={() => toggleTheme()}
                jobs={jobs}
                keys={keys}
                isProcessing={isProcessing}
                globalPaused={globalPaused}
                maxConcurrency={maxConcurrency}
                setMaxConcurrency={setMaxConcurrency}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                onFilesAdded={handleFilesAdded}
                onStart={handleStartAll}
                onPauseAll={handlePauseAll}
                onCancelJob={handleCancelJob}
                onRetryJob={handleRetryJob}
                onOpenAdmin={() => setIsAdminPanelOpen(true)}
                updateJob={updateJobsState}
                onLogout={handleLogout}
            />
        </main>
    </div>
  );
};

export default App;