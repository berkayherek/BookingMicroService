# 🏨 Hotel Booking Microservices Application

A distributed, service-oriented web application for hotel reservations featuring dynamic pricing (ML), real-time inventory management, and asynchronous notifications.

### 📺 Project Demo
**[CLICK HERE TO WATCH THE VIDEO PRESENTATION (5 Min)]**  
*(e.g., https://youtu.be/your-video-link)*

---

## 🚀 Deployed Application Links
*   **User Frontend:** [https://your-frontend-app.onrender.com](https://your-frontend-app.onrender.com)
*   **Admin Portal:** [https://your-frontend-app.onrender.com/admin](https://your-frontend-app.onrender.com) *(Accessible via Admin Login)*
*   **API Gateway:** [https://your-gateway-app.onrender.com](https://your-gateway-app.onrender.com)

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
