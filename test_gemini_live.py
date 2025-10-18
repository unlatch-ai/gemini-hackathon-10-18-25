"""
Quick test script to verify Gemini Live API function calling works
"""
import asyncio
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv('.env.local')

client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
model = "gemini-2.5-flash-native-audio-preview-09-2025"

def get_system_instruction():
    return """You are a safety monitoring assistant. Your ONLY job is to listen carefully and detect when someone says the phrase "so help me god".

IMPORTANT:
- If you hear "so help me god" (or close variations), immediately call the trigger_emergency_call function.
- Do NOT respond with audio or text unless you detect the codeword.
- Be sensitive to different pronunciations, accents, and speaking speeds."""

def get_function_declarations():
    return [{
        "function_declarations": [{
            "name": "trigger_emergency_call",
            "description": "Triggers an emergency phone call when the panic codeword is detected",
            "parameters": {
                "type": "object",
                "properties": {
                    "detected_phrase": {"type": "string"},
                    "confidence": {"type": "number"},
                    "timestamp": {"type": "string"}
                },
                "required": ["detected_phrase"]
            }
        }]
    }]

async def main():
    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=get_system_instruction(),
        tools=get_function_declarations(),
    )

    print("🚀 Starting Gemini Live session...")
    async with client.aio.live.connect(model=model, config=config) as session:
        print("✅ Connected to Gemini Live API")

        # Send a text message with the codeword
        print("📝 Sending test message with codeword...")
        await session.send_client_content(
            turns={"role": "user", "parts": [{"text": "so help me god"}]},
            turn_complete=True
        )

        print("👂 Listening for response...")
        async for response in session.receive():
            if response.tool_call:
                print(f"🚨 FUNCTION CALL DETECTED!")
                for fc in response.tool_call.function_calls:
                    print(f"   Function: {fc.name}")
                    print(f"   Args: {fc.args}")
                    return  # Exit after detecting

            if response.text:
                print(f"Text response: {response.text}")

if __name__ == "__main__":
    asyncio.run(main())
