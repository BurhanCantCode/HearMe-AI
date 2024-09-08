'use client';
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, FileText, Pause, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export function HomePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingComplete, setIsRecordingComplete] = useState(false);
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null); // Reference for file input

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  }, [isRecording]);

  const startRecording = async () => {
    setIsRecordingComplete(false);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);
    mediaRecorder.current.start();

    audioChunks.current = [];
    mediaRecorder.current.addEventListener('dataavailable', (event) => {
      audioChunks.current.push(event.data);
    });

    mediaRecorder.current.addEventListener('stop', async () => {
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
      if (audioBlob.size > 0) {
        const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
        const fileName = `audio_${timestamp}.wav`;

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const currentUser = auth.currentUser;
          if (currentUser) {
            const userUID = currentUser.uid;
            const userAudiosRef = collection(db, 'users', userUID, 'audios');

            try {
              await addDoc(userAudiosRef, {
                fileName,
                audioData: base64data,
                timestamp: new Date().toISOString(),
              });
              toast.success('Audio uploaded successfully!');
              setIsRecordingComplete(true); // Set to true after successful upload
            } catch (error) {
              console.error('Error saving audio data to Firestore:', error);
              toast.error('Error uploading audio. Please try again.');
            }
          }
        };
        reader.readAsDataURL(audioBlob);
      } else {
        console.error('Audio Blob is empty. No data recorded.');
      }
    });
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      setIsRecordingComplete(true);
    }
  };

  const handleTranscribe = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const userUID = currentUser.uid;
      setIsLoading(true);
      try {
        const response = await axios.get(`/api/summary?userId=${userUID}`);
        setSummary(response.data.response);
        toast.success('Summary fetched successfully!');
      } catch (error) {
        console.error('Error fetching summary:', error);
        setSummary('Error fetching summary. Please try again.');
        toast.error('Error fetching summary. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'audio/wav') {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const currentUser = auth.currentUser;
        if (currentUser) {
          const userUID = currentUser.uid;
          const userAudiosRef = collection(db, 'users', userUID, 'audios');
          const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
          const fileName = `uploaded_audio_${timestamp}.wav`;

          try {
            await addDoc(userAudiosRef, {
              fileName,
              audioData: base64data,
              timestamp: new Date().toISOString(),
            });
            toast.success('Audio uploaded successfully!');
            setIsRecordingComplete(true); // Ensure this is set to true after upload
          } catch (error) {
            console.error('Error saving audio data to Firestore:', error);
            toast.error('Error uploading audio. Please try again.');
          }
        }
      };
      reader.readAsDataURL(file);
    } else {
      toast.error('Please upload a valid WAV file.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 relative">
      <ToastContainer />
      <Button
        onClick={handleLogout}
        className="absolute top-4 right-4 bg-gray-800 hover:bg-gray-700 text-white transition-transform transform hover:scale-105"
      >
        <LogOut className="mr-2 h-4 w-4" /> Logout
      </Button>
      <header className="mb-12">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-transparent bg-clip-text"
        >
          HearMe AI
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-xl text-gray-400"
        >
          Transcribe, Summarize, Understand
        </motion.p>
      </header>

      <main className="max-w-4xl mx-auto">
        <Card className="bg-gray-900 border-gray-800 mb-8 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col space-y-4">
              <div className="flex justify-between">
                <Button
                  onClick={() => setIsRecording(!isRecording)}
                  className={`${
                    isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                  } text-white transition-transform transform hover:scale-105 w-full mr-2`}
                >
                  {isRecording ? <Pause className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </Button>
                <Button
                  onClick={handleTranscribe}
                  className="bg-purple-600 hover:bg-purple-700 text-white transition-transform transform hover:scale-105 w-full"
                  disabled={!isRecordingComplete || isLoading}
                >
                  <FileText className="mr-2 h-4 w-4" /> {isLoading ? 'Loading...' : 'Summary'}
                </Button>
              </div>
              <div className="flex justify-between">
                <label className="flex items-center w-full">
                  <input
                    type="file"
                    accept=".wav"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-green-600 hover:bg-green-700 text-white transition-transform transform hover:scale-105 w-full"
                  >
                    Upload Audio
                  </Button>
                </label>
              </div>
            </div>
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="w-full h-32 bg-gray-800 rounded-lg overflow-hidden mb-4"
                >
                  <motion.div
                    animate={{
                      height: ['20%', '80%', '50%', '100%', '70%', '30%'],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      repeatType: 'reverse',
                    }}
                    className="w-full bg-blue-500"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-400">Summary</h2>
            {summary ? (
              <div className="text-gray-300" dangerouslySetInnerHTML={{ __html: summary }} />
            ) : (
              <div className="text-center text-gray-500">
                <FileText className="mx-auto h-12 w-12 mb-4" />
                <p>Your summary will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-12 text-center"
        >
          <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
          <div className="flex justify-center gap-8">
            <div className="flex flex-col items-center">
              <Mic className="h-12 w-12 text-blue-500 mb-2" />
              <p className="text-sm">Record Audio</p>
            </div>
            <div className="flex flex-col items-center">
              <FileText className="h-12 w-12 text-green-500 mb-2" />
              <p className="text-sm">Get Summary</p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
