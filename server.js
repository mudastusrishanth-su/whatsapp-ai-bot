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

        /*
        ====================================
        SEND DETAILS TO TEAM
        ====================================
        */

        await sendMessage(
          teamNumber,
          escalationMessage
        );

        /*
        ====================================
        SEND IMAGE TO TEAM
        ====================================
        */

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

        /*
        ====================================
        CONFIRM TO STUDENT
        ====================================
        */

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

`✅ Your chat session has been reset.

Send Hi to start again.`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      SMART GREETING FLOW
      ====================================
      */

      if (
        text === "hi" ||
        text === "hello" ||
        text === "hey" ||
        text === "hii" ||
        text === "hi i have a question" ||
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
      FALLBACK MENU
      ====================================
      */

      if (
        userSessions[from] ===
        "waiting_for_query"
      ) {

        await sendMessage(
          from,

`📌 Please choose your issue category:

1️⃣ Login Issues
2️⃣ Payment Issues
3️⃣ Offer Letter
4️⃣ Live Classes
5️⃣ Lesson Plans
6️⃣ Certificates
7️⃣ Domain Change
8️⃣ Test / Exam / Hackathon Issues

Or explain your issue in detail 😊`
        );

        userSessions[from] = null;

        return res.sendStatus(200);
      }

      /*
      ====================================
      LOGIN ISSUE FLOW
      ====================================
      */

      if (
        text.includes("login") ||
        text.includes("unable to login") ||
        text.includes("taptap login") ||
        text.includes("tap tap login")
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

This helps our support team identify the exact issue faster 😊`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      DOMAIN CHANGE FLOW
      ====================================
      */

      if (
        text.includes("domain change") ||
        text.includes("change domain") ||
        text.includes("change my domain") ||
        text.includes("switch domain") ||
        text.includes("change specialization") ||
        text.includes("change course")
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
• offer letter screenshot

Your domain change request will be reviewed by the support team 😊`
        );

        return res.sendStatus(200);
      }

      /*
      ====================================
      TEST / HACKATHON / EXAM ISSUE FLOW
      ====================================
      */

      if (
        text.includes("test link") ||
        text.includes("exam link") ||
        text.includes("hackathon") ||
        text.includes("assessment error") ||
        text.includes("exam error") ||
        text.includes("test error") ||
        text.includes("unable to start test") ||
        text.includes("unable to attend exam")
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
5️⃣ Test / Hackathon / Exam Link

📸 Also upload:
• screenshot
OR
• screen recording of the issue 😊`
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
• screen recording of the issue

Your issue will be escalated to the support team immediately 😊`
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

Your role is ONLY to help students regarding:
- internships
- TapTap LMS
- classes
- offer letters
- assessments
- certificates
- internship support

====================================
IMPORTANT RULES
====================================

- Be professional and friendly
- Keep replies short and WhatsApp-friendly
- Use emojis naturally
- Solve student queries clearly
- Never give fake information

====================================
IMPORTANT INFORMATION
====================================

Internship Registration:
https://internships.blackbucks.me

TapTap LMS:
https://taptap.blackbucks.me

Offer letters:
24-48 working hours after payment verification.

====================================
LIVE CLASSES INFORMATION
====================================

Live classes are conducted through Zoom.

Weekly class schedules are shared every Sunday in the official WhatsApp group for the upcoming week.

Live Zoom class links are shared directly in the official WhatsApp group before each session starts.

Classes are conducted:
- 2-3 times per week
- Saturdays also

No live classes on Sundays.

Assignments, assessments, and activity links are shared in the WhatsApp groups.

TapTap LMS does NOT host live classes.

TapTap LMS is used for:
- recorded class videos
- lesson plans
- assignments
- assessments
- activities

If a student asks:
- "Where will we get live classes?"
- "Where is the class link?"
- "How to attend classes?"
- "Where do we get Zoom link?"

Reply:
"The weekly class schedule is shared every Sunday in your official WhatsApp group 😊

The live Zoom class links are shared directly in the WhatsApp group before every class."

If a student says:
- "I missed the class"
- "I couldn't attend the class"
- "I missed live session"

Reply:
"The recorded session will be available in your lesson plan inside TapTap LMS 😊"

====================================
PAYMENT & DASHBOARD INFORMATION
====================================

The registration/payment website and TapTap LMS are different platforms.

Registration website:
used only for:
- internship registration
- payment

TapTap LMS:
used for:
- classes
- lesson plans
- assignments
- assessments
- activities

Sometimes the registration dashboard may still show "Pay Now" even after successful payment.

This is normal in many cases.

====================================
TEST / HACKATHON / EXAM SUPPORT
====================================

If a student asks regarding:
- test link issue
- hackathon issue
- exam issue
- assessment issue
- unable to start test
- exam link not working

Ask the student to share:

1️⃣ Full Name
2️⃣ Registered Email ID
3️⃣ Registered Mobile Number
4️⃣ Roll Number
5️⃣ Test / Exam / Hackathon Link

Then ask the student to upload:
- screenshot
OR
- screen recording

Then escalate the issue to the support team immediately.

====================================
LESSON PLAN LINKS
====================================

Quantum Systems Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80081&testType=collegeLessonPlan

Data Platform Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80082&testType=collegeLessonPlan

Generative AI Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80074&testType=collegeLessonPlan

AI Machine Learning Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80073&testType=collegeLessonPlan

Java Full Stack Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80086&testType=collegeLessonPlan

MERN Stack Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80087&testType=collegeLessonPlan

Cloud Infrastructure & DevOps Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80077&testType=collegeLessonPlan

Cyber Defense & Security Analyst:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80075&testType=collegeLessonPlan

Embedded & IoT Systems Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80078&testType=collegeLessonPlan

Semiconductor Design Engineer (VLSI):
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80083&testType=collegeLessonPlan

Python Automation Developer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80076&testType=collegeLessonPlan

Mobile Software Engineer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80085&testType=collegeLessonPlan

Product UI/UX Designer:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80080&testType=collegeLessonPlan

Data & Business Intelligence Analyst:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80079&testType=collegeLessonPlan

Associate Product Manager:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80084&testType=collegeLessonPlan

Growth Marketing & CRM Specialist:
https://taptap.blackbucks.me/lessonPlan/?lessonPlanId=80088&testType=collegeLessonPlan

====================================
IMPORTANT CONDITION
====================================

Only share lesson plan links if:
- student completed payment
AND
- student received offer letter

====================================
DOMAIN CHANGE SUPPORT
====================================

If a student asks regarding:
- domain change
- changing internship domain
- switching domain
- changing course
- changing specialization

Then do NOT directly answer.

Ask the student to share:

1️⃣ Full Name
2️⃣ Registered Email ID
3️⃣ Registered Mobile Number
4️⃣ Existing Domain
5️⃣ New Domain Requested

After collecting details, ask the student to upload:
- payment screenshot
OR
- offer letter screenshot

Then escalate the issue to the support team.

Tell the student:

"Your domain change request will be reviewed by the support team 😊"
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