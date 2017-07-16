import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.externals import joblib

def main():
    trainmodel()

def trainmodel():
    # Load Data
    training_data = 'data/fake_or_real_news.csv'
    df = pd.read_csv(training_data)

    for key in df: # Drop all columns apart from title and label
        if not (key == 'title' or key == 'label'):
            del df[key]

    # Mold data
    label_map = {'FAKE' : 0, 'REAL' : 1}
    df['label'] = df['label'].map(label_map)

    # Split Data to X, y
    X = df['title'].values     # predictor feature
    y = df['label'].values # predicted class

    # Vectorization
    count_vectorizer = CountVectorizer(max_features=1000)
    X_count = count_vectorizer.fit_transform(X)

    # Split Test and Training Data
    split_test_size = 0.30
    X_train, X_test, y_train, y_test = train_test_split(X_count, y, test_size=split_test_size, random_state=42) 
                            # test_size = 0.3 is 30%, 42 is the answer to everything
    
    # Fit model
    clf = LogisticRegression()
    clf.fit(X_train, y_train)

    # Dump vectorizer
    vectorizer_directory = 'vectorizer'
    vectorizer_file_name = '{}/vectorizer.pkl'.format(vectorizer_directory)
    joblib.dump(count_vectorizer, vectorizer_file_name)

    print('vectorizer saved')

    # Dump model
    model_directory = 'model'
    model_file_name = '{}/model.pkl'.format(model_directory)
    joblib.dump(clf, model_file_name)

    print('model saved')

if __name__ == '__main__': main()