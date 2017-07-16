# Fake News API
A simple fake news API using Machine Learning algorithm

### Dependencies
- scikit-learn
- Flask
- pandas
- numpy

```
pip install -r requirements.txt
```

# Endpoints
### /predict (GET) param claim

```
prediction = 'real' or 'fake'
{'prediction': prediction, 'probabilty': probabilty}
```