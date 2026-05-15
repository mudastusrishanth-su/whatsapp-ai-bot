require("dotenv").config();

const express = require("express");
const Groq = require("groq-sdk");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/*
====================================
MEMORY STORAGE
====================================
*/

const sessions = {};
const userSessions = {};

/*
====================================
SEND WHATSAPP MESSAGE
====================================
*/

async function sendMessage(to, message) {

  const response = await fetch(
    `https://graph.facebook.com/v25.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        Authorization:
          `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },

      body: JSON.stringify({
        messaging_product: "whatsapp",

        to: to,

        text: {
          body: message,
        },
      }),
    }
  );

  const data = await response.json();

  console.log(data);
}

/*
====================================
HOME ROUTE
====================================
*/

app.get("/", (req, res) => {

  res.send("Blackbucks AI Bot Running 🚀");
});

/*
====================================
WEBHOOK VERIFY
====================================
*/

app.get("/webhook", (req, res) => {

  const VERIFY_TOKEN =
    process.env.VERIFY_TOKEN;

  const mode =
    req.query["hub.mode"];

  const token =
    req.query["hub.verify_token"];

  const challenge =
    req.query["hub.challenge"];

  if (
    mode &&
    token === VERIFY_TOKEN
  ) {

    console.log("Webhook Verified");

    res.status(200).send(challenge);

  } else {

    res.sendStatus(403);
  }
});

/*
====================================
MAIN WEBHOOK
====================================
*/

app.post("/webhook", async (req, res) => {

  try {

    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (
      message &&
      message.type === "text" &&
      !message.from_me
    ) {

      const from = message.from;

      const text =
        message.text.body.toLowerCase().trim();

      console.log("Student:", text);

      /*
      ====================================
      CREATE SESSION
      ====================================
      */

      if (!sessions[from]) {
        sessions[from] = [];
      }

      /*
      ====================================
      STORE USER MESSAGE
      ====================================
      */

      sessions[from].push({
        role: "user",
        content: text
      });

      /*
      ====================================
      MAIN MENU
      ====================================
      */

      if (
        text === "hi" ||
        text === "hello" ||
        text === "hey"
      ) {

        userSessions[from] = "main_menu";

        await sendMessage(
          from,

`👋 Welcome to Blackbucks Internship Support

Please choose an option:

1️⃣ Internship Registration
2️⃣ TapTap website  Support
3️⃣ Offer Letter Query
4️⃣ Internship Details
5️⃣ Payment Issue
6️⃣ Certificate Query`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      INTERNSHIP MENU
      ====================================
      */

      if (
        userSessions[from] === "main_menu" &&
        text === "1"
      ) {

        userSessions[from] = "internship_menu";

        await sendMessage(
          from,

`📚 Internship Query

Please choose:

1️⃣ General Internship Information
2️⃣ Specific Internship Query`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      SPECIFIC INTERNSHIP QUERY
      ====================================
      */

      if (
        userSessions[from] === "internship_menu" &&
        text === "2"
      ) {

        userSessions[from] = "specific_internship";

        await sendMessage(
          from,

`🔎 Please share your internship-related issue.

Examples:
• Offer Letter
• Classes
• Syllabus
• Payment
• Duration`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      GROQ AI RESPONSE
      ====================================
      */

      const completion =
        await groq.chat.completions.create({

          messages: [

            {
              role: "system",

              content: `
You are Blackbucks AI Internship Support Assistant.

Your role is ONLY to help students regarding internship-related queries, internship process support, TapTap LMS support, payments, offer letters, classes, assessments, and certificates.

================================================
AI BEHAVIOR RULES
================================================

- Reply professionally and politely
- Use friendly professional tone
- Use 1-2 relevant emojis naturally
- Sound like a real internship support executive
- Avoid robotic replies
- Keep replies short and WhatsApp-friendly
- Maximum try to solve the issue
- Do not generate fake information
- If you don't understand the issue, politely ask the student to explain clearly
- If issue is still unclear or unresolved, ask them to contact support on the same number
- If student repeatedly says issue not solved, human support, call me, or still issue, inform them that the issue will be escalated to the support team

================================================
INTERNSHIP FLOW UNDERSTANDING
================================================

Students usually follow this process:

1. Register for internship
2. Pay internship fee
3. Receive offer letter through email
4. Receive WhatsApp group link in the offer letter
5. Join official internship WhatsApp group
6. Attend live classes conducted 2-3 times per week
7. Complete daily assessments after classes
8. Complete weekly assessments and employability activities
9. Receive certificate after successful completion

================================================
GENERAL INFORMATION
================================================

Internship Registration Link:
https://internships.blackbucks.me

TapTap LMS Login:
https://taptap.blackbucks.me

Live internships start from:
18th May onwards

================================================
COLLEGE-WISE INTERNSHIP FEES
================================================

For:
- SRKR
- KITS Akshar
- KITS Guntur
- Vagdevi

Online Internship Fee:
₹650

For:
- ISTS College

Online Internship Fee:
₹750

For all other colleges:
₹850

================================================
COLLEGE NAME UNDERSTANDING
================================================

SRKR refers to:
SRKR Engineering College

KITS Akshar refers to:
KITS Akshar Institute of Technology

KITS Guntur refers to:
KKR & KSR Institute of Technology and Sciences

Vagdevi refers to:
Vagdevi Engineering College

ISTS refers to:
ISTS Women's Engineering College

================================================
TAPTAP LMS SUPPORT
================================================

TapTap is the internship learning platform.

Students use it for:
- lesson plans
- syllabus
- assessments
- activities

Common issue:
"User already exists"

If this happens:
Ask them to login using registered email ID and use Forgot Password option.

================================================
INTERNSHIP DETAILS
================================================

Live classes:
2-3 times per week

Activities:
- Daily assessments
- Weekly assessments
- Placement tests
- Employability tests

================================================
CLASS LANGUAGE
================================================

Classes are explained in English.

Experts help irrespective of language.

================================================
PAYMENT & OFFER LETTER SUPPORT
================================================

Offer letters:
24-48 working hours after payment verification.

If paid multiple times:
Ask them to wait 48 hours.

If both failed and successful email received:
Tell them to ignore failed email if successful email later arrived.

Saturday Rule:
Before Saturday 3 PM → email usually by Saturday evening.

After Saturday 3 PM or Sunday:
Wait until Monday afternoon.

WhatsApp group link is shared in offer letter email.

================================================
CERTIFICATE SUPPORT
================================================

Certificates are issued after successful internship completion.

================================================
ROLL NUMBER
================================================

College registration number means roll number.

================================================
STATE / UNIVERSITY SUPPORT
================================================

If student is from AP or Andhra Pradesh:
Share Dheeraj support contact.

If student is from Amity:
DO NOT directly share Nagarjuna number.
First understand issue and try solving it.

================================================
UNKNOWN QUESTIONS
================================================

If unclear:
Ask student to explain properly.

If still unresolved:
Ask them to contact support on same number.
`
            },

            ...sessions[from]
          ],

          model: "llama-3.1-8b-instant",
        });

      /*
      ====================================
      AI REPLY
      ====================================
      */

      const aiReply =
        completion.choices[0]
        .message.content;

      console.log("AI:", aiReply);

      /*
      ====================================
      STORE AI REPLY
      ====================================
      */

      sessions[from].push({
        role: "assistant",
        content: aiReply
      });

      /*
      ====================================
      LIMIT MEMORY
      ====================================
      */

      if (sessions[from].length > 10) {

        sessions[from] =
          sessions[from].slice(-10);
      }

      /*
      ====================================
      SEND AI REPLY
      ====================================
      */

      await sendMessage(
        from,
        aiReply
      );

      console.log("Reply Sent ✅");
    }

    res.sendStatus(200);

  } catch (error) {

    console.log(error);

    res.sendStatus(500);
  }
});

/*
====================================
START SERVER
====================================
*/

app.listen(3000, () => {

  console.log(
    "🚀 AI Server running on port 3000"
  );
});