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
const escalationData = {};

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
      (
        message.type === "text" ||
        message.type === "image"
      ) &&
      !message.from_me
    ) {

      const from = message.from;

      /*
      ====================================
      HANDLE IMAGE ESCALATION
      ====================================
      */

      if (
        message.type === "image" &&
        userSessions[from] ===
        "waiting_for_screenshot"
      ) {

        const teamNumber =
          process.env.TEAM_WHATSAPP_NUMBER;

        const issueData =
          escalationData[from];

        const imageId =
          message.image.id;

        const escalationMessage =

          `🚨 STUDENT ISSUE ESCALATION

👤 Student Details:

${issueData.details}

⚠️ Issue:
${issueData.issue}

📸 Screenshot proof attached below.

Please check and assist the student.`;

        await sendMessage(
          teamNumber,
          escalationMessage
        );

        await fetch(
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

              to: teamNumber,

              type: "image",

              image: {
                id: imageId
              }
            }),
          }
        );

        await sendMessage(
          from,

          `✅ Your issue has been escalated successfully along with screenshot proof.

Our support team will contact you shortly 😊`
        );

        delete escalationData[from];

        userSessions[from] = null;

        return res.sendStatus(200);
      }

      /*
      ====================================
      HANDLE TEXT MESSAGE
      ====================================
      */

      const text =
        message.text.body.toLowerCase().trim();

      console.log("Student:", text);

      /*
      ====================================
      RESET CHAT
      ====================================
      */

      if (
        text === "reset" ||
        text === "restart"
      ) {

        sessions[from] = [];
        userSessions[from] = null;
        delete escalationData[from];

        await sendMessage(
          from,

          `✅ Chat reset successful.

Send Hi to start again 😊`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      GREETING FLOW
      ====================================
      */

      if (
        text === "hi" ||
        text === "hello" ||
        text === "hey" ||
        text === "hii" ||
        text === "i have a question"
      ) {

        userSessions[from] =
          "waiting_for_query";

        await sendMessage(
          from,

          `👋 Hi, how are you? 😊

I'm the Blackbucks AI Support Assistant.

How can I help you today?`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      AI INTENT DETECTION
      ====================================
      */

      const intentCheck =
        await groq.chat.completions.create({

          messages: [

            {
              role: "system",

              content: `
You are an AI intent classifier.

Identify the user's support issue category.

Reply ONLY with ONE keyword:

LOGIN_ISSUE
PAYMENT_ISSUE
DOMAIN_CHANGE
EXAM_ISSUE
GENERAL_SUPPORT

No explanation.
`
            },

            {
              role: "user",
              content: text
            }
          ],

          model: "llama-3.3-70b-versatile",
        });

      const detectedIntent =
        intentCheck.choices[0]
          .message.content
          .trim();

      console.log(
        "Detected Intent:",
        detectedIntent
      );

      /*
      ====================================
      LOGIN ISSUE FLOW
      ====================================
      */

      if (
        detectedIntent ===
        "LOGIN_ISSUE"
      ) {

        userSessions[from] =
          "collect_issue_details";

        escalationData[from] = {
          issue:
            "TapTap LMS Login Issue"
        };

        await sendMessage(
          from,

          `📋 Please share the following details:

1️⃣ Full Name
2️⃣ College Name
3️⃣ Registered Email ID
4️⃣ Roll Number
5️⃣ Registered Phone Number

📸 After sharing details, please upload:
• screenshot
OR
• screen recording of the issue 😊`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      PAYMENT ISSUE FLOW
      ====================================
      */

      if (
        detectedIntent ===
        "PAYMENT_ISSUE"
      ) {

        await sendMessage(
          from,

          `✅ Please don’t worry 😊

The internship registration/payment website and TapTap LMS are different platforms.

• Registration website → internship registration & payment
• TapTap LMS → classes, lesson plans, assessments, assignments, activities

Sometimes the dashboard may still show "Pay Now" even after successful payment. This is normal in many cases.

📩 Offer letters are usually shared within 24-48 working hours after payment verification.

📱 Official WhatsApp group links and internship instructions are shared through your offer letter email.

🎥 Live classes are conducted through Zoom and schedules are shared weekly in the WhatsApp group.`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      DOMAIN CHANGE FLOW
      ====================================
      */

      if (
        detectedIntent ===
        "DOMAIN_CHANGE"
      ) {

        userSessions[from] =
          "collect_domain_change_details";

        escalationData[from] = {
          issue:
            "Domain Change Request"
        };

        await sendMessage(
          from,

          `📋 Please share the following details for domain change request:

1️⃣ Full Name
2️⃣ Registered Email ID
3️⃣ Registered Mobile Number
4️⃣ Existing Domain
5️⃣ New Domain Requested

📸 After sharing details, please upload:
• payment screenshot
OR
• offer letter screenshot 😊`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      EXAM ISSUE FLOW
      ====================================
      */

      if (
        detectedIntent ===
        "EXAM_ISSUE"
      ) {

        userSessions[from] =
          "collect_exam_issue";

        escalationData[from] = {
          issue:
            "Test / Hackathon / Exam Issue"
        };

        await sendMessage(
          from,

          `📋 Please share the following details:

1️⃣ Full Name
2️⃣ Registered Email ID
3️⃣ Registered Mobile Number
4️⃣ Roll Number
5️⃣ Test / Exam / Hackathon Link

📸 Also upload:
• screenshot
OR
• screen recording of the issue 😊`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      LESSON PLAN FLOW
      ====================================
      */

      if (
        detectedIntent ===
        "LESSON_PLAN"
      ) {

        await sendMessage(
          from,

          `📚 Please share your internship domain name.

Example:
• AIML
• Java Full Stack
• MERN
• UI/UX
• DevOps
• Generative AI

I'll share the lesson plan accordingly 😊`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      COLLECT LOGIN ISSUE DETAILS
      ====================================
      */

      if (
        userSessions[from] ===
        "collect_issue_details"
      ) {

        escalationData[from].details =
          text;

        userSessions[from] =
          "waiting_for_screenshot";

        await sendMessage(
          from,

          `📸 Thank you for sharing your details.

Now please upload:
• screenshot
OR
• screen recording

This helps our support team identify the issue faster 😊`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      COLLECT DOMAIN CHANGE DETAILS
      ====================================
      */

      if (
        userSessions[from] ===
        "collect_domain_change_details"
      ) {

        escalationData[from].details =
          text;

        userSessions[from] =
          "waiting_for_screenshot";

        await sendMessage(
          from,

          `📸 Thank you for sharing your details.

Now please upload:
• payment screenshot
OR
• offer letter screenshot 😊`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      COLLECT EXAM ISSUE DETAILS
      ====================================
      */

      if (
        userSessions[from] ===
        "collect_exam_issue"
      ) {

        escalationData[from].details =
          text;

        userSessions[from] =
          "waiting_for_screenshot";

        await sendMessage(
          from,

          `📸 Thank you for sharing your details.

Now please upload:
• screenshot
OR
• screen recording of the issue 😊`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      CREATE MEMORY
      ====================================
      */

      if (!sessions[from]) {
        sessions[from] = [];
      }

      sessions[from].push({
        role: "user",
        content: text
      });

      /*
      ====================================
      MAIN AI RESPONSE
      ====================================
      */

      const completion =
        await groq.chat.completions.create({

          messages: [

            {
              role: "system",

              content: `
You are Blackbucks AI Support Assistant.

You are a professional, friendly and human-like internship support executive.

Your job is to help students regarding:
- internships
- TapTap LMS
- offer letters
- classes
- Zoom sessions
- recordings
- assessments
- lesson plans
- certificates
- internship process

IMPORTANT RULES:
- Keep replies short
- WhatsApp friendly
- Conversational
- Human-like
- Helpful
- Do NOT sound robotic
- Never generate fake information

====================================
IMPORTANT INFORMATION
====================================

Registration Website:
https://internships.blackbucks.me

This website is ONLY for:
- internship registration
- internship payment

Student LMS Dashboard:
https://taptap.blackbucks.me

TapTap LMS contains:
- lesson plans
- recordings
- assignments
- assessments
- activities
- study materials

====================================
LIVE CLASSES
====================================

• Live classes are conducted through Zoom
• Weekly schedules are shared every Sunday in official WhatsApp groups
• Zoom links are shared directly in WhatsApp groups before class starts
• Recorded sessions are available in lesson plans
• No live classes on Sundays

====================================
PAYMENT INFORMATION
====================================

• Dashboard may still show "Pay Now" after payment
• This is normal sometimes
• Offer letters are shared within 24-48 working hours after verification
• Students should check:
  - Spam folder
  - Promotions tab
  - All Mail section

====================================
LESSON PLAN RULE
====================================

Only share lesson plan links if:
- payment completed
AND
- offer letter received

====================================
REAL SUPPORT EXAMPLES
====================================

Student:
I missed class

Assistant:
No problem 😊

The recorded session will be available inside your lesson plan in TapTap LMS.

Student:
Where are live classes conducted?

Assistant:
🎥 Live classes are conducted through Zoom.

📅 Weekly schedules are shared every Sunday in your official WhatsApp group.

🔗 Zoom links are shared directly in the WhatsApp group before every session starts.

Student:
in what streams or domains do you provide internships

Assistant:
😊 You can find all available internship domains, streams and complete internship details at:

https://internships.blackbucks.me

Student:
I paid but dashboard still shows pay now

Assistant:
Please don’t worry 😊

The registration website and TapTap LMS are different platforms.

Sometimes the dashboard may still show "Pay Now" even after successful payment.

Student:
There is no login option

Assistant:
😊 internships.blackbucks.me is only for internship registration & payment.

Your student dashboard is:
https://taptap.blackbucks.me

Student:
Will there be projects involved?

Assistant:
Yes 😊

Students work on assignments, assessments, activities and domain-related practical tasks during the internship.

Student:
I cannot find resources

Assistant:
Please check your lesson plan inside TapTap LMS 😊

All resources including:
• recordings
• assignments
• assessments
• activities
• study materials

will be available there.
`
                
            },

            ...sessions[from]
          ],

          model: "llama-3.1-8b-instant",
        });

      const aiReply =
        completion.choices[0]
        .message.content;

      console.log("AI:", aiReply);

      sessions[from].push({
        role: "assistant",
        content: aiReply
      });

      if (sessions[from].length > 10) {

        sessions[from] =
          sessions[from].slice(-20);
      }

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