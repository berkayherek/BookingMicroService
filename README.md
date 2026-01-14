# 🏨 Hotel Booking Microservices Application

A distributed, service-oriented web application for hotel reservations featuring dynamic pricing (ML), real-time inventory management, and asynchronous notifications.

### 📺 Project Demo
**[CLICK HERE TO WATCH THE VIDEO PRESENTATION (5 Min)]**  
*(e.g., https://youtu.be/your-video-link)*

---

## 🚀 Deployed Application Links
*   **User Frontend:** https://userfrontend-4gh0.onrender.com
*   **Admin Portal:**  https://adminfrontend-8wob.onrender.com *(Accessible via Admin Login)*
*   **API Gateway:** https://gateaway-zbw5.onrender.com
*   **Hotel Service** https://hotelservice-ojiv.onrender.com
*   **Notification center** https://notification-kbml.onrender.com

---

## 🏗 System Architecture & Design

This project follows a **Microservices Architecture** pattern to ensure scalability and separation of concerns.

### Tech Stack
*   **Frontend:** React (Vite), Axios
*   **Backend:** Node.js (Express), Python (Flask)
*   **Database:** Google Firebase (Firestore)
*   **Auth:** Firebase Authentication
*   **Messaging:** RabbitMQ (Asynchronous communication)
*   **Caching:** Redis (Search optimization)
*   **Infrastructure:** Docker

### Microservices Breakdown
1.  **API Gateway (Port 5000):** Single entry point. Handles routing, Authentication (JWT verification), and Role-Based Access Control (RBAC).
2.  **Hotel Service (Port 5001):** Manages inventory, search, and booking transactions. Connects to Redis for caching.
3.  **Notification Service (Port 5002):**
    *   **Consumer:** Listens to RabbitMQ `booking_queue` to confirm bookings.
    *   **Scheduler:** Runs a Cron job to check hotel capacity and alert admins if stock < 20%.
4.  **ML Service (Port 5004):** A Python-based service that calculates dynamic pricing based on seasonality (Summer vs. Winter) and room types.

---
Assumptions & Implementation Details
Transactional Inventory:
We do not use a simple global counter. Instead, availability is calculated dynamically by checking for date overlaps against the total room count for a specific hotel.
Seasonality (ML):
The Python service assumes "High Season" is June-September (1.5x Multiplier) and "Low Season" is Dec-Feb (0.8x Multiplier).
Low Capacity Alert:
For demonstration purposes, the Notification Service randomly sets a hotel's capacity percentage upon booking to trigger the "Low Stock" alert in the logs immediately.
Map Feature:
We use Google Maps Embed API to display the exactLocation string stored in the database.
⚠️ Issues Encountered & Solutions
Date Overlap Logic:
Issue: Preventing double bookings without locking the room for the entire year.
Solution: Implemented a Firestore Transaction that queries only bookings overlapping the requested Start and End dates before confirming.
Microservice Communication:
Issue: Node.js needed to talk to Python for pricing.
Solution: Used synchronous HTTP (Axios) for pricing (since the user needs the price immediately) but asynchronous RabbitMQ for notifications (which can happen in the background).
CORS & Gateway:
Issue: Frontend requests were blocked when hitting services directly.
Solution: Configured http-proxy-middleware in the Gateway so the frontend only talks to port 5000.
🛠 Local Installation Guide
Clone the Repository
code
Bash
git clone https://github.com/your-username/hotel-microservices.git
cd hotel-microservices
Setup Secrets
Place your serviceAccountKey.json (Firebase Admin Key) into:
backend/gateway/
backend/hotel-service/
backend/notification-service/
Run with Docker Compose
code
Bash
docker-compose up --build
Access
Frontend: http://localhost:5173
Gateway: http://localhost:5000
code
Code
***

## 📊 Data Models (ER Diagram)

Although Firestore is a NoSQL document database, the logical relationships between entities are defined as follows:

```mermaid
erDiagram
    User ||--|{ Booking : makes
    Hotel ||--|{ Booking : contains
    Hotel ||--|{ Room : has

    User {
        string uid "Firebase Auth ID"
        string email
        string role "ADMIN or USER"
    }

    Hotel {
        string id
        string name
        string location
        string exactLocation
        number basePrice
        array rooms "Embedded Object"
    }

    Room {
        string type "Standard, Suite"
        int count "Total Inventory"
        int price
    }

    Booking {
        string id
        string userId
        string hotelId
        date startDate
        date endDate
        string status "CONFIRMED"
        float totalPrice
    }


