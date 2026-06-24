from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Initialize SQLAlchemy
db = SQLAlchemy()

class Prediction(db.Model):
    __tablename__ = 'predictions'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    filename = db.Column(db.String(255), nullable=False)
    predicted_class = db.Column(db.String(50), nullable=False)
    confidence = db.Column(db.Float, nullable=False)
    severity = db.Column(db.String(10), nullable=False)  # 'Low', 'Medium', 'High', or 'N/A'
    symptoms = db.Column(db.Text, nullable=False)
    causes = db.Column(db.Text, nullable=False)
    pesticide = db.Column(db.String(255), nullable=False)
    organic_alternative = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        """Convert model instance to a dictionary for JSON API responses."""
        return {
            'id': self.id,
            'filename': self.filename,
            'predicted_class': self.predicted_class,
            'confidence': round(self.confidence, 2),
            'severity': self.severity,
            'symptoms': self.symptoms,
            'causes': self.causes,
            'pesticide': self.pesticide,
            'organic_alternative': self.organic_alternative,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }

def init_db(app):
    """Binds the SQLAlchemy object to the Flask app and creates database tables."""
    db.init_app(app)
    with app.app_context():
        db.create_all()
        print("Database initialized and tables created.")
