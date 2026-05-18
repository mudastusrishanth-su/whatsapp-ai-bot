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

    const body = req.body;

const message =
  body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

// Ignore status updates
if (!message) {
  console.log("Ignoring non-message webhook event");
  return res.sendStatus(200);
}

const rawText = message?.text?.body;
// Ignore non-text messages
if (!text) {
  console.log("No text body found");
  return res.sendStatus(200);
}

console.log("Student:", text);

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
        return res.sendStatus(200);

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
  rawText.toLowerCase().trim();

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
      text = text.toLowerCase().trim();
      if (
        text === "hi" ||
        text === "hello" ||
        text === "hey" ||
        text === "hii" 
        
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
You are an AI intent classifier for Blackbucks Support.

Your job is ONLY to identify whether the student needs SUPPORT TEAM ESCALATION.

Reply ONLY with ONE keyword:

LOGIN_ISSUE
PAYMENT_ISSUE
OFFER_LETTER_ISSUE
DOMAIN_CHANGE
EXAM_ISSUE
GENERAL_SUPPORT

LOGIN_ISSUE
→ ONLY if student cannot login, dashboard not opening, password issue, access issue, LMS technical issue.

PAYMENT_ISSUE

→ ONLY if:
• payment deducted
• payment failed
• payment pending
• payment verification issue
• dashboard still shows pay now

DO NOT classify offer letter delays or onboarding email delays as PAYMENT_ISSUE.

DOMAIN_CHANGE
→ ONLY if student clearly wants to:

* change domain
* switch internship stream
* change specialization

EXAM_ISSUE
→ ONLY if:

* exam link not working
* test link issue
* hackathon issue
* assessment technical problem

If students ask about domains, streams, courses or internships available:
- share the official internship domain list
- ask students to register through internships.blackbucks.me
- do NOT ask students to select domains inside the chat

GENERAL_SUPPORT
→ for ALL normal questions including:

* internship details
* domains available
* internship duration
* internship cost
* live classes
* zoom links
* schedules
* recordings
* lesson plans
* resources
* projects
* certificates
* class timings
* course information
* general doubts

IMPORTANT:
If the user is ONLY asking information or doubts,
ALWAYS reply:
GENERAL_SUPPORT

Reply ONLY with the keyword.
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
OFFER LETTER ISSUE FLOW
====================================
*/

if (
  detectedIntent ===
  "OFFER_LETTER_ISSUE"
) {

  userSessions[from] =
    "waiting_offer_letter_confirmation";

  await sendMessage(
  from,

`Please don’t worry 😊

Offer letters and onboarding emails are usually shared within 24–48 working hours after payment verification.

Please check:
• Inbox
• Spam folder
• Promotions tab

If you still haven’t received any email after 48 working hours, please reply:
still not received`
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
OFFER LETTER FOLLOW-UP
====================================
*/

if (
  userSessions[from] ===
  "waiting_offer_letter_confirmation"
) {

  if (
    text.includes("still not received") ||
    text.includes("not received") ||
    text.includes("didn't receive")
  ) {

    userSessions[from] =
      "collect_offer_letter_issue";

    escalationData[from] = {
      issue:
        "Offer Letter Not Received"
    };

    await sendMessage(
      from,

`📋 Please share:

1️⃣ Registered Email ID
2️⃣ Payment Screenshot
3️⃣ Payment Date & Time

Our support team will verify and assist you 😊`
    );

    return res.sendStatus(200);
  }
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
COLLECT OFFER LETTER DETAILS
====================================
*/

if (
  userSessions[from] ===
  "collect_offer_letter_issue"
) {

  escalationData[from].details =
    text;

  userSessions[from] =
    "waiting_for_screenshot";

  await sendMessage(
    from,

    `📸 Thank you for sharing the details.

Now please upload:
• payment screenshot
OR
• payment proof 😊`
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
- Always use proper grammar and spelling
- Never claim that you checked internal systems
- Never say verification completed unless explicitly provided
- Never generate fake offer letter status
- Never generate fake student records
- Never pretend to access databases
- If information is unavailable, politely ask the student to contact support
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
Is attendance mandatory?

Assistant:
✅ Yes, attendance is mandatory for internship completion.

Students are expected to:
• attend live classes
• complete assignments
• participate in activities
• complete assessments

Regular participation is important for successful internship completion and certificate eligibility and AttNDnce will bE shARED TO THE COLLEGE TPO  😊

Student:
What domains do you provide?

Assistant:
🚀 We currently provide internships in the following domains:

• AI Machine Learning Engineer
• Associate Product Manager
• Cloud Infrastructure & DevOps Engineer
• Cyber Defense & Security Analyst
• Data & Business Intelligence Analyst
• Data Platform Engineer
• Embedded & IoT Systems Engineer
• Generative AI Engineer
• Growth Marketing & CRM Specialist
• Java Full Stack Engineer
• MERN Stack Engineer
• Mobile Software Engineer
• Product UI/UX Designer
• Python Automation Developer
• Quantum Systems Engineer
• Semiconductor Design Engineer

🔗 Students can explore and register through:
https://internships.blackbucks.me

Student:
What courses are available?

Assistant:
📚 Available internship domains:

• AI Machine Learning Engineer
• Associate Product Manager
• Cloud Infrastructure & DevOps Engineer
• Cyber Defense & Security Analyst
• Data & Business Intelligence Analyst
• Data Platform Engineer
• Embedded & IoT Systems Engineer
• Generative AI Engineer
• Growth Marketing & CRM Specialist
• Java Full Stack Engineer
• MERN Stack Engineer
• Mobile Software Engineer
• Product UI/UX Designer
• Python Automation Developer
• Quantum Systems Engineer
• Semiconductor Design Engineer

🔗 Registration Website:
https://internships.blackbucks.me
BAD EXAMPLE:

Student:
Modify my offer letter

Assistant:
I updated your offer letter successfully.

(This is WRONG.)

GOOD EXAMPLE:

Student:
Modify my offer letter

Assistant:
Please contact the support team for offer letter modifications and share:
• registered email ID
• roll number
• correction details
• supporting proof 😊

BAD EXAMPLE:

Student:
Check my offer letter status

Assistant:
I checked the system and your offer letter is verified.

(This is WRONG because the AI has no database access.)

GOOD EXAMPLE:

Student:
Check my offer letter status

Assistant:
📩 Offer letters are usually shared within 24-48 working hours after payment verification.

Please also check:
• Spam folder
• Promotions tab
• All Mail section

If still not received after 48 working hours, please contact support with:
• registered email ID
• payment screenshot
• payment date & time 😊

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