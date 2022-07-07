require("dotenv").config()
const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const paypal = require("@paypal/checkout-server-sdk");
const admin = require('firebase-admin');

admin.initializeApp({
"HERE GOES THE FIREBASE CONFIG"
});

const app = express();

app.use(cors({
  origin: true
}));
app.use(express.json());

const Environment =
  process.env.NODE_ENV === "production"
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment
const paypalClient = new paypal.core.PayPalHttpClient(
  new Environment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  )
)

const storeItems = new Map([
  [1, { price: 100, name: "Learn React Today" }],
  [2, { price: 200, name: "Learn CSS Today" }],
])


app.post("/create-order", async (req, res) => {
  const { orderTotal, orderItems } = req.body
  const db = admin.firestore();
  const items = [];
  for (let i = 0, j = orderItems.length; i < j; i++) {
    const { documentID } = orderItems[i];
    const doc = await db.collection("products").doc(documentID).get();

    if (doc.exists) {
      const data = doc.data();
      items.push({
        name: orderItems[i].productName,
        unit_amount: {
          currency_code: "EUR",
          value: data.productPrice,
        },
        quantity: orderItems[i].quantity,
      })
    }

  }

  const request = new paypal.orders.OrdersCreateRequest()
  request.prefer("return=representation")
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "EUR",
          value: orderTotal,
          breakdown: {
            item_total: {
              currency_code: "EUR",
              value: orderTotal,
            },
          },
        },
        items: items
      },
    ],
  })

  try {
    const order = await paypalClient.execute(request)
    res.json({ id: order.result.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }

})


app.get('*', (req, res) => {
  res
    .status(404)
    .send('404, Not Found.');
});

exports.api = functions.https.onRequest(app);
