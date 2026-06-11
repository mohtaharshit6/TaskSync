import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            An unexpected error occurred. Your data is safe — try reloading the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
