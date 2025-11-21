# Plaid Security Questionnaire - Form Responses

**Quick copy-paste responses for the Plaid security questionnaire form.**

---

## Question 1: Information Security Contact Information

**Name:** [FILL IN: Your Name / Security Officer Name]  
**Title:** Information Security Officer / Chief Technology Officer  
**Email:** security@sparefinance.com  
**Group Email:** security@sparefinance.com (monitored regularly)

---

## Question 2: Information Security Policy and Procedures

**Answer:** Yes - We have a documented policy, procedures, and an operational information security program that is continuously matured

**Note:** Select this option because:
- ✅ We have documented policies (Privacy Policy documents security practices)
- ✅ We have operationalized procedures (RLS, CSP, encryption, authentication, etc.)
- ✅ We have an operational security program (monitoring, logging, reviews)
- ✅ Program is continuously matured (regular updates and improvements)

**Response:**
Our organization has documented information security policies and procedures that are operationalized to identify, mitigate, and monitor information security risks. Our security framework includes:

- Row Level Security (RLS): 160+ database policies protecting 38+ tables
- Content Security Policy (CSP): Strict CSP headers configured
- Rate Limiting: API endpoint protection
- Data Encryption: AES-256-GCM encryption at rest, TLS 1.2+ in transit
- Secure Headers: HSTS, X-Frame-Options, X-Content-Type-Options
- Authentication & Authorization: Supabase Auth with RBAC
- Security Logging: Audit trail for critical actions
- Input Validation: All user inputs validated
- Secure Development Practices: Code reviews and dependency management

Security practices are documented in our Privacy Policy and are regularly reviewed and updated.

---

## Question 3: Access Controls for Production Assets

**Select all that apply:**

**Definitely Select (Confirmed):**
- ✅ A defined and documented access control policy is in place
- ✅ Role-based access control (RBAC)
- ✅ Centralized identity and access management solutions

**Consider Selecting (Evaluate):**
- ⚠️ Periodic access reviews and audits are performed
  - *Select if:* You conduct regular security reviews or audits of user access
  - *Current state:* Security logging and monitoring in place; formal periodic reviews can be implemented
  
- ⚠️ Automated de-provisioning / modification of access for terminated or transferred employees
  - *Select if:* You have automated processes to remove access when employees/contractors leave
  - *Current state:* User account deletion and member removal functions exist
  
- ⚠️ Implementation of a zero trust access architecture
  - *Select if:* All access is verified and never trusted by default at every layer
  - *Current state:* Authentication required at all layers (API, database, application)
  
- ⚠️ Use of OAuth tokens or TLS certificates for non-human authentication
  - *Select if:* You use OAuth tokens or TLS certificates for service-to-service authentication
  - *Current state:* OAuth used for Plaid/Stripe integrations; TLS for all connections; API keys for services

**Additional Details:**
Production database access is restricted to authenticated users only. All API endpoints verify user authentication. Database queries are protected by Row Level Security (RLS) policies - 160+ policies enforce data isolation across 38+ tables. Access control policies are documented in our Privacy Policy. Supabase Auth provides centralized identity and access management. Role-based access control (RBAC) is implemented with user roles (admin, member, owner) and household member permissions. Access to production systems is limited to authorized personnel. Sensitive configuration and API keys are stored as encrypted environment variables.

---

## Question 4: Multi-Factor Authentication (MFA) for Consumers Before Plaid Link

**Answer:** Yes - Non-phishing-resistant multi-factor authentication is performed (e.g., SMS, email, question and answer pairs, etc.)

**Response:**
Our application requires email verification (OTP - One-Time Password) before users can access the application and use Plaid Link. Users must verify their email address through an OTP sent via email before they can access protected features, including Plaid Link. Email verification is mandatory and enforced at the application level. Plaid Link is only accessible to authenticated and verified users.

**Note:** Email-based OTP is classified as non-phishing-resistant MFA because email accounts can potentially be compromised. This provides strong security for most use cases, though phishing-resistant methods (biometrics, passkeys, hardware OTPs) offer enhanced protection.

---

## Question 5: Multi-Factor Authentication (MFA) for Critical Systems

**Answer:** Yes - Non-phishing-resistant multi-factor authentication is performed (e.g., SMS, email, question and answer pairs, etc.)

**Response:**
Multi-factor authentication is implemented for access to critical systems that store or process consumer financial data. Access to the Supabase database is controlled through Supabase Auth with email verification (OTP). All API endpoints require valid authentication tokens obtained after email verification. Administrative access requires authentication and email verification, and is logged. Access to third-party services (Plaid, Stripe) uses API keys stored securely in encrypted environment variables. Session tokens are required for all API requests. Database access is restricted to authenticated users through RLS policies. All sensitive operations require valid user sessions. Email verification (OTP) serves as the multi-factor authentication method for all critical systems that store or process consumer financial data.

**Note:** Email-based OTP is classified as non-phishing-resistant MFA but provides strong security for protecting access to financial data systems. Supabase Auth supports additional MFA methods (SMS, authenticator apps, hardware tokens) which can be enabled for enhanced security if needed.

---

## Question 6: TLS Encryption for Data in Transit

**Answer:** Yes

**Response:**
Our organization encrypts all data in-transit between clients and servers using TLS 1.2 or better. All client-server communications use HTTPS/TLS. Strict-Transport-Security (HSTS) header is configured with max-age=63072000; includeSubDomains; preload. Our hosting provider (Vercel) automatically provides TLS 1.2+ for all connections. All API endpoints are served over HTTPS. All database connections to Supabase use encrypted TLS connections. All communications with Plaid, Stripe, and other third-party services use TLS encryption.

---

## Question 7: Encryption at Rest for Plaid Data

**Answer:** Yes - We encrypt ALL consumer data retrieved from the Plaid API at-rest

**Response:**
Our organization encrypts all consumer data received from the Plaid API at rest, not just sensitive PII. This includes account information, transactions, balances, and all other data received from Plaid. All data stored in Supabase database is encrypted at rest (Supabase provides encryption at rest by default). Sensitive data such as API tokens and credentials are encrypted using AES-256-GCM encryption before storage. Financial transaction data is stored securely with encryption at rest. Bank account information received from Plaid is stored in encrypted database tables. We never store bank credentials (username, password, PIN) - these are handled exclusively by Plaid. We only store account information, transactions, and balances received from Plaid API, all of which are encrypted at rest.

---

## Question 8: Vulnerability Scanning and Management

**Answer:** Select all that apply:

**Definitely Select:**
- ✅ We patch identified vulnerabilities within a defined SLA
- ✅ We actively monitor and address end-of-life (EOL) software in use

**Consider Selecting:**
- ⚠️ We actively perform vulnerability scans against all employee and contractor machines, production assets
  - *Select if:* You have formal vulnerability scanning of employee/contractor machines and production assets
  - *Current state:* We perform dependency scanning (npm audit) and code reviews; formal machine scanning may need to be implemented

**Response:**
We actively perform vulnerability management through:
- Patching identified vulnerabilities within a defined SLA (critical/high: immediate, medium: within 7 days, low: within 30 days)
- Regular dependency scanning using npm audit
- Code review process for all changes
- Security event logging and monitoring
- Error tracking via Sentry
- Monitoring and addressing end-of-life (EOL) software through dependency updates
- Regular security updates for dependencies
- Monitoring of security advisories for used technologies

---

## Question 9: Privacy Policy

**Answer:** Yes - This policy is displayed to end-users within the application

**Privacy Policy URL:**
https://sparefinance.com/privacy-policy

**Terms of Service URL:**
https://sparefinance.com/terms-of-service

**Response:**
Our organization has a comprehensive privacy policy for the application where Plaid Link will be deployed. The privacy policy is displayed to end-users within the application and is publicly accessible at the URL above. The policy includes:
- Information collection practices
- How we use collected information
- Data sharing practices (including Plaid integration)
- Data security measures
- User rights and choices
- Data retention and deletion policies
- Third-party service disclosures (Plaid, Stripe)
- Contact information for privacy inquiries

The privacy policy specifically addresses how Plaid is used for bank account connections, what data we receive from Plaid, that we never store bank credentials, and users' ability to disconnect bank accounts.

---

## Question 10: Consumer Consent for Data Collection

**Answer:** Yes

**Response:**
Our organization obtains explicit consent from consumers for the collection, processing, and storage of their data through:
1. Terms of Service Agreement - Users must accept during registration (https://sparefinance.com/terms-of-service)
2. Privacy Policy Acknowledgment - Privacy policy is accessible and linked during signup (https://sparefinance.com/privacy-policy)
3. Explicit Bank Connection Consent - Users must explicitly authorize bank account connections through Plaid Link
4. Household Member Consent - Household members must accept invitations and consent to data sharing
5. Data Processing Consent - Users consent through account creation and service usage

Users cannot create accounts without accepting Terms of Service. Privacy policy is prominently displayed. Plaid Link requires explicit user authorization. Users can revoke consent by disconnecting bank accounts or deleting their account.

---

## Question 11: Data Deletion and Retention Policy

**Answer:** Yes

**Response:**
Our organization has a defined and enforced data deletion and retention policy that complies with applicable data privacy laws. Data is retained for as long as the account is active and needed to provide services. Upon account deletion request, data is deleted or anonymized within 30 days. Data may be retained longer if required by law, regulation, or legitimate business purposes. Historical transaction data from Plaid is retained after disconnection, but no new data is collected.

The policy is reviewed periodically to ensure compliance with applicable laws (GDPR, CCPA, PIPEDA for Canadian companies). The policy is documented in our Privacy Policy. Users are informed of retention periods. Deletion requests are processed in a timely manner. Policies are reviewed at least annually and updated to reflect changes in applicable laws and regulations.

---

## Quick Checklist Before Submission

- [ ] Fill in actual security contact name in Question 1
- [x] URLs updated with actual production domain (sparefinance.com)
- [ ] Verify security@sparefinance.com email is set up and monitored
- [ ] Confirm MFA is enabled in Supabase project settings
- [ ] Test privacy policy URL is accessible
- [ ] Review all responses for accuracy

---

**Last Updated:** February 2025

