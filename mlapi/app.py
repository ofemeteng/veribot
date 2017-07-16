#Fake news classifier API for Facebook veribot

#dependencies
import os
from flask import Flask, jsonify
import numpy as np
from sklearn.externals import joblib
from socket import gethostname

#load local file
from train import trainmodel

app = Flask(__name__)

@app.route('/', methods=['GET'])
def home():
    return 'We are live'

@app.route('/train', methods=['GET'])
def train():
    trainmodel()
    return 'Model trained and saved successfully'

@app.route('/predict/<claim>', methods=['GET'])
def predict(claim):
    if vect and clf:
        try:
            label = {0: 'FAKE', 1: 'REAL'}
            title = [claim]
            title_vector = vect.transform(title)
            prediction = label[clf.predict(title_vector)[0]]
            probability = round(np.max(clf.predict_proba(title_vector)) * 100, 2)

            return jsonify({'prediction': prediction, 'probabilty': probability})

        except Exception as e:
            return jsonify({'error': str(e)})
    else:
        return 'model or vectorizer not found'

if __name__ == '__main__':
    try:
        cur_dir = os.getcwd()
        vectorizer_directory = os.path.join(cur_dir, 'vectorizer')
        vectorizer_file_name = '{}/vectorizer.pkl'.format(vectorizer_directory)
        vect = joblib.load(vectorizer_file_name)
        print('vectorizer loaded')

    except Exception as e:
        print('No vectorizer found')
        vect = None

    try:
        cur_dir = os.getcwd()
        model_directory = os.path.join(cur_dir, 'model')
        model_file_name = '{}/model.pkl'.format(model_directory)
        clf = joblib.load(model_file_name)
        print('model loaded')

    except Exception as e:
        print('No model found')
        clf = None

    if 'liveconsole' not in gethostname():
        app.run()