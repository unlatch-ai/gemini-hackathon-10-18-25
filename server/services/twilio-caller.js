import twilio from 'twilio';
import { config } from '../config.js';

class TwilioCaller {
  constructor() {
    this.client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    this.fromNumber = config.TWILIO_PHONE_NUMBER;
    this.userNumber = config.USER_PHONE_NUMBER;
  }

  async triggerFakeCall(sessionId, scenario = 'mom') {
    try {
      console.log(`📞 Triggering fake call for session ${sessionId} with scenario: ${scenario}`);

      const baseUrl = config.BASE_URL || `http://localhost:${config.PORT}`;

      const call = await this.client.calls.create({
        to: this.userNumber,
        from: this.fromNumber,
        url: `${baseUrl}/twilio/voice?scenario=${scenario}`,
        statusCallback: `${baseUrl}/twilio/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
      });

      console.log(`✅ Call triggered successfully! Call SID: ${call.sid}`);

      return {
        success: true,
        callSid: call.sid,
        scenario: scenario
      };
    } catch (error) {
      console.error(`❌ Error triggering call:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getTwiML(scenario = 'mom') {
    const scenarios = {
      mom: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Hey sweetie! It's mom. I'm running late picking up dinner.
    Can you head over to the house in about 10 minutes? I need help with something.
  </Say>
  <Pause length="5"/>
  <Say voice="Polly.Joanna">
    Oh perfect! Thanks honey, see you soon!
  </Say>
  <Hangup/>
</Response>`,

      friend: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">
    Hey! My car broke down on the highway.
    Can you come pick me up? I'm near the Market Street exit. Sorry for the trouble!
  </Say>
  <Pause length="5"/>
  <Say voice="Polly.Matthew">
    Thanks! I'll send you the exact location. Hurry!
  </Say>
  <Hangup/>
</Response>`,

      work: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">
    Hi, this is Sarah from the office. We have an urgent situation with the Johnson account.
    Can you come in right away? It's really important.
  </Say>
  <Pause length="5"/>
  <Say voice="Polly.Amy">
    Great, we'll see you in 15 minutes. Thanks!
  </Say>
  <Hangup/>
</Response>`
    };

    return scenarios[scenario] || scenarios.mom;
  }
}

export default new TwilioCaller();
