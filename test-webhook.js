import crypto from 'crypto';
import http from 'http';

const webhookUrl = 'http://localhost:3000/api/webhook';
const signatureKey = 'tB2t6FgtVKvg0Wy_udUZlQ'; // From compose.dev.yaml

// Test webhook payload
const payload = {
  type: 'customer.created',
  event_id: 'test-event-123',
  merchant_id: 'test-merchant-123',
  data: {
    object: {
      customer: {
        id: 'test-customer-123',
        given_name: 'Test',
        family_name: 'User',
        phone_number: '+1234567890',
        email_address: 'test@example.com'
      }
    }
  }
};

// Convert payload to string
const payloadString = JSON.stringify(payload);

// Create signature
const hmac = crypto.createHmac('sha256', signatureKey);
hmac.update(payloadString);
const signature = hmac.digest('base64');

// Send request
const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-square-hmacsha256-signature': signature
  }
};

const req = http.request(webhookUrl, options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  res.on('data', (chunk) => {
    console.log('Response:', chunk.toString());
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(payloadString);
req.end(); 