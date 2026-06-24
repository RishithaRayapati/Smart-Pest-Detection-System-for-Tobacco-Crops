# Deployment Guide: AI-Based Tobacco Crop Pest Detection System

This guide outlines the steps to deploy the application in production environments using Railway, Render, or Amazon Web Services (AWS) with a MySQL database.

---

## 1. Local / Production Database Setup

### Using MySQL
For production, we transition from SQLite to a MySQL server.

1. **Install MySQL Server** (if not already installed).
2. **Create the Database and User**:
   ```sql
   CREATE DATABASE tobacco_pest;
   CREATE USER 'tobacco_user'@'localhost' IDENTIFIED BY 'secure_password';
   GRANT ALL PRIVILEGES ON tobacco_pest.* TO 'tobacco_user'@'localhost';
   FLUSH PRIVILEGES;
   ```
3. **Configure Connection**:
   In your production deployment, configure the `DATABASE_URL` environment variable:
   ```bash
   DATABASE_URL="mysql+pymysql://tobacco_user:secure_password@localhost:3306/tobacco_pest"
   ```

---

## 2. Deploying to Railway (Recommended)

Railway is highly recommended because it easily provisions MySQL databases alongside web services.

### Step 1: Push to GitHub
Initialize git in the project root and push to a GitHub repository:
```bash
git init
git add .
git commit -m "Initial commit of TobaccoGuard platform"
# Create repository on GitHub and link it
git remote add origin <github-repo-url>
git branch -M main
git push -u origin main
```

### Step 2: Configure Railway Service
1. Go to [Railway.app](https://railway.app) and create an account.
2. Click **New Project** -> **Deploy from GitHub repo** -> Select your repository.
3. Click **Add Service** -> Select **Database** -> Choose **MySQL**.
4. Railway will spin up a MySQL service. Wait for it to initialize.

### Step 3: Link Variables & Deploy
1. Click on the web service container in Railway.
2. Under **Variables**, add the following environment variables:
   - `DATABASE_URL`: `${{MySQL.MYSQL_URL}}` (Railway will automatically replace this with the connection string for the MySQL database database service).
   - `SECRET_KEY`: Create a random secret string.
   - `PORT`: `5000` (or leave default).
3. Under **Settings**, set the **Start Command**:
   ```bash
   gunicorn app:app
   ```
4. Click **Deploy**. Railway will install dependencies, link the database, and host the site.

---

## 3. Deploying to Render

Render is a robust, free-tier cloud hosting platform.

### Step 1: Create a PostgreSQL or MySQL Database
*Note: Render natively supports PostgreSQL on the free tier, which is fully compatible with our database ORM code.*
1. Log in to [Render.com](https://render.com).
2. Click **New** -> **PostgreSQL**.
3. Name the database, select a region, and click **Create Database**.
4. Once active, copy the **Internal Database URL** or **External Database URL**.

### Step 2: Create a Web Service
1. Click **New** -> **Web Service**.
2. Connect your GitHub repository.
3. Configure the following fields:
   - **Environment**: `Python`
   - **Build Command**: `pip install -r requirements.txt && python ml/generate_dummy_data.py && python ml/train.py && python ml/evaluate.py` (This builds the model on compilation if not pre-packaged!).
   - **Start Command**: `gunicorn app:app`
4. Under **Advanced**, add environment variables:
   - `DATABASE_URL`: Pasteurize your Render PostgreSQL connection string.
   - `SECRET_KEY`: Random string.
   - `PYTHON_VERSION`: `3.10.0`
5. Click **Deploy Web Service**.

---

## 4. Deploying to AWS Elastic Beanstalk (EC2 + RDS)

For corporate/commercial scalability.

### Step 1: Create RDS MySQL Instance
1. Go to AWS Console -> RDS -> **Create Database**.
2. Select **MySQL**, configure Free Tier settings, set Master Username and Password.
3. In Connectivity, set Public Access to Yes (if deploying Beanstalk in default VPC), and note the RDS Endpoint URL.

### Step 2: Create Beanstalk Configuration
1. Install AWS CLI and Elastic Beanstalk CLI (`eb cli`).
2. Run `eb init` in your project folder, choosing Python 3.10 as the platform.
3. Create a `.ebextensions/django.config` (Elastic Beanstalk configuration file) to describe the application:
   ```yaml
   option_settings:
     aws:elasticbeanstalk:container:python:
       WSGIPath: app:app
   ```

### Step 3: Set Variables & Deploy
1. Run `eb create tobacco-pest-env`.
2. Go to Beanstalk Configuration -> Updates -> Environment Properties, and add:
   - `DATABASE_URL`: `mysql+pymysql://<user>:<password>@<rds-endpoint>:3306/<database>`
   - `SECRET_KEY`: `<secret-key>`
3. Deploy changes with `eb deploy`.

---

## 5. Performance Optimizations for Cloud Web Services

> [!WARNING]
> Standard TensorFlow is large (~500MB) and exceeds the memory limit of some free cloud hosting containers during startup.
> If you encounter `Out of Memory` (OOM) or slug size limit issues on Render or Railway, apply these optimizations:
>
> 1. **Use `tensorflow-cpu`**:
>    Replace `tensorflow` in `requirements.txt` with `tensorflow-cpu` to reduce deployment size by 60%.
> 2. **Export to ONNX**:
>    Convert the Keras model to ONNX runtime format. This allows replacing the massive TensorFlow dependency with a tiny library `onnxruntime` (~15MB), speeding up inference times and reducing memory footprint.
