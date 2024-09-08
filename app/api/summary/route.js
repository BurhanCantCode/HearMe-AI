import { NextResponse } from 'next/server';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import axios from 'axios';
import { ChatGroq } from '@langchain/groq'; // Import ChatGroq

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
  }

  try {
    const userAudiosRef = collection(db, 'users', userId, 'audios');
    const recentAudioQuery = query(userAudiosRef, orderBy('timestamp', 'desc'), limit(1));
    const querySnapshot = await getDocs(recentAudioQuery);

    if (querySnapshot.empty) {
      return NextResponse.json({ message: 'No audio found for the user' }, { status: 404 });
    }

    const recentAudio = querySnapshot.docs[0].data();
    const { audioData } = recentAudio; // This is now a Base64 string

    // Decode Base64 audio data to a binary Buffer
    const audioBuffer = Buffer.from(audioData.split(',')[1], 'base64'); // Remove the data URL part

    const headers = {
      Authorization: `Token ${process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY}`,
      'Content-Type': 'audio/wav',
    };

    const response = await axios.post('https://api.deepgram.com/v1/listen', audioBuffer, { headers });
    
    // Log the response from Deepgram
    console.log('Deepgram response:', response.data);

    // Extract summary and transcript
    const summary = extractSummary(response.data);
    const transcript = extractTranscript(response.data);

    // Process the summary with ChatGroq
    const groqResponse = await processSummary(summary, transcript);
    
    return NextResponse.json({ success: true, response: groqResponse }, { status: 200 });
  } catch (error) {
    console.error('Error fetching or processing audio:', error);
    return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}

function extractSummary(response) {
  try {
    const summary = response.results.channels[0].alternatives[0].summary || 'No summary available';
    return summary;
  } catch (error) {
    return 'Summary not found in the response';
  }
}

function extractTranscript(response) {
  try {
    const transcript = response.results.channels[0].alternatives[0].transcript || 'No transcript available';
    return transcript;
  } catch (error) {
    return 'Transcript not found in the response';
  }
}

async function processSummary(summary, transcript) {
  const llm = new ChatGroq({
    api_key: process.env.GROQ_API_KEY,
    model: 'mixtral-8x7b-32768', // Use the appropriate model
    temperature: 0,
  });

  const prompt = `Please refine the provided summary of the audio content into a highly structured, detailed, and professional tone. Ensure the summary is well-organized, with distinct sections, appropriate headings, and correct punctuation to make it polished and easy to follow. Include all essential details and make sure the summary is comprehensive, adding any necessary clarity or depth to ensure a professional standard.

Here is the transcript of the audio: ${transcript}

Here's the provided summary of the audio: ${summary}
`;

  const aiMsg = await llm.invoke(prompt); // Invoke the model with the prompt

  return aiMsg.content; // Return the content of the AI message
}