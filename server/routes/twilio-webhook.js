import express from 'express';
import twilio from 'twilio';
import { analyzeMessageWithGemini } from '../services/gemini.js';
import { submitTo311 } from '../services/sf311.js';
import { currentModel } from '../index.js';
import { addMessage, addRequest } from '../storage.js';

const { MessagingResponse } = twilio.twiml;
const router = express.Router();

// Twilio webhook endpoint for incoming messages
router.post('/webhook', async (req, res) => {
  try {
    const { From, Body, MessageSid } = req.body;

    console.log(`📨 Incoming message from ${From}: ${Body}`);

    // Create Twilio response
    const twiml = new MessagingResponse();

    // Analyze the message with Gemini using the currently selected model
    const analysis = await analyzeMessageWithGemini(Body, currentModel);

    if (!analysis) {
      twiml.message('Sorry, I could not understand your request. Please provide more details about the issue, including the location.');
      return res.type('text/xml').send(twiml.toString());
    }

    console.log('🤖 Gemini Analysis:', JSON.stringify(analysis, null, 2));

    // If confidence is too low, ask for clarification
    if (analysis.confidence < 0.7) {
      twiml.message(
        `I think you're reporting: ${analysis.requestType} at ${analysis.location}. ` +
        `However, I'm not very confident. Could you provide more details?`
      );
      return res.type('text/xml').send(twiml.toString());
    }

    // Submit to SF 311
    let result;
    let requestStatus = 'Pending';
    let sf311CaseId = undefined;

    try {
      result = await submitTo311(analysis, From, MessageSid);

      if (result.success) {
        requestStatus = 'Submitted';
        sf311CaseId = result.caseId;

        twiml.message(
          `✅ Your ${analysis.requestType} report has been submitted to SF 311!\n\n` +
          `📍 Location: ${analysis.location}\n` +
          `📋 Case ID: ${result.caseId}\n\n` +
          `You can track your request at: ${result.trackingUrl || 'https://www.sf.gov/check-status-311-request'}`
        );
      } else {
        requestStatus = 'Failed';

        twiml.message(
          `⚠️ I understood your request but couldn't submit it automatically.\n\n` +
          `📍 ${analysis.requestType} at ${analysis.location}\n\n` +
          `Please submit manually at: https://www.sf.gov/topics/311-online-services\n` +
          `Reason: ${result.error}`
        );
      }
    } catch (submitError) {
      console.error('❌ Error submitting to 311:', submitError);
      requestStatus = 'Failed';

      twiml.message(
        `⚠️ I understood your request:\n\n` +
        `📍 ${analysis.requestType} at ${analysis.location}\n\n` +
        `But there was an error submitting. Please try submitting manually at:\n` +
        `https://www.sf.gov/topics/311-online-services`
      );
    }

    // Store the message and request in memory
    const message = {
      id: MessageSid,
      from: From,
      timestamp: new Date().toISOString(),
      text: Body,
      analysis: analysis,
      automationLog: result?.automationLog || []
    };

    const request = {
      id: `req_${Date.now()}`,
      messageId: MessageSid,
      requestType: analysis.requestType,
      status: requestStatus,
      submittedAt: new Date().toISOString(),
      sf311CaseId: sf311CaseId
    };

    addMessage(message);
    addRequest(request);

    console.log('💾 Stored message and request in memory');

    res.type('text/xml').send(twiml.toString());

  } catch (error) {
    console.error('❌ Error processing webhook:', error);

    const twiml = new MessagingResponse();
    twiml.message('Sorry, there was an error processing your request. Please try again later.');
    res.type('text/xml').send(twiml.toString());
  }
});

// Status callback endpoint (optional)
router.post('/status', (req, res) => {
  const { MessageStatus, MessageSid } = req.body;
  console.log(`📊 Message ${MessageSid} status: ${MessageStatus}`);
  res.sendStatus(200);
});

export default router;
