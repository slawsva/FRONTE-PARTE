
  # Создание интернет-магазина FRONTE PARTE

  This is a code bundle for Создание интернет-магазина FRONTE PARTE. The original project is available at https://www.figma.com/design/oepwcxYypl7PRtXzXe9PkG/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%B8%D0%B5-%D0%B8%D0%BD%D1%82%D0%B5%D1%80%D0%BD%D0%B5%D1%82-%D0%BC%D0%B0%D0%B3%D0%B0%D0%B7%D0%B8%D0%BD%D0%B0-FRONTE-PARTE.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Admin access

  The storefront has a protected administrator login and a basic admin panel for product management.

  1. Copy `.env.example` to `.env`.
  2. Generate a password hash:

     ```bash
     npm run security:hash -- "your-long-password"
     ```

  3. Put the generated value into `FP_ADMIN_PASSWORD_HASH` and set a long random `FP_SESSION_SECRET`.
  4. Start the secure server:

     ```bash
     npm run secure:preview
     ```

  5. Open the account icon, choose `ADMIN`, use login `FRONTE` and the password you used to generate the hash.

  ## New product email notifications

  Registered customer emails are stored by the secure server in `.fp-secure-data/customers.json`.
  When an admin adds a new product, the server sends a notification only to customers who checked the email opt-in box during registration.

  Configure email delivery in `.env`:

  ```bash
  FP_PUBLIC_SITE_URL=https://your-domain.example
  FP_EMAIL_FROM="FRONTE PARTE <notifications@your-domain.example>"
  FP_RESEND_API_KEY=re_your_real_resend_key
  ```

  If `FP_EMAIL_FROM` or `FP_RESEND_API_KEY` is missing, the product is still created and the server logs that email sending was skipped.
  
