'use client'

import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { checkAnswer } from '../lib/answer-checker'
import { saveGameHistory } from '../actions/game'
import { AutocompleteInput } from '../components/AutocompleteInput'
import { getSuggestions } from '../lib/suggestions'

export default function PracticePage() {
    const { user } = useAuth()
    const [question, setQuestion] = useState('')
    const [answer, setAnswer] = useState('')
    const [userAnswer, setUserAnswer] = useState('')
    const [isAnswerRevealed, setIsAnswerRevealed] = useState(false)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [showingAnswer, setShowingAnswer] = useState(false)

    const handleQuestionSelect = async (selectedQuestion: string) => {
        setQuestion(selectedQuestion)
        setUserAnswer('')
        setIsAnswerRevealed(false)
        setIsCorrect(null)
        setError(null)
        setShowingAnswer(false)

      try {
        const suggestions = await getSuggestions(selectedQuestion)
        if (suggestions.length > 0) {
            setAnswer(suggestions[0].answer)
        }
    } catch (error) {
          console.error('Error getting answer:', error)
          setError('Failed to load answer')
      }
  }

    const handleAnswerSubmit = async () => {
        if (!question || !answer || !user?.id) {
            setError('Something went wrong. Please try again.')
            return
        }

      try {
        const result = checkAnswer(userAnswer, answer)

        // Show the result immediately
        setIsCorrect(result)
        setIsAnswerRevealed(true)

        // Save the result
        await saveGameHistory(
            user.id,
            question, // Using question as ID in practice mode
            result,
            result ? 200 : 0 // Default value for practice mode
        )
    } catch (error) {
          console.error('Error processing answer:', error)
      }
  }

    const handleShowAnswer = () => {
        setShowingAnswer(true)
        setIsAnswerRevealed(true)
        setIsCorrect(null)

      if (user?.id) {
          // Save the answer as incorrect when showing answer
          saveGameHistory(
              user.id,
              question,
              false,
              0
          ).catch(console.error)
      }
  }

    const handleNextQuestion = () => {
        setQuestion('')
        setAnswer('')
        setUserAnswer('')
        setIsAnswerRevealed(false)
        setIsCorrect(null)
        setShowingAnswer(false)
    }

    return (
      <div className="container mx-auto p-4">
          <h1 className="text-2xl font-bold mb-4">Practice Mode</h1>

          {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
              </div>
          )}

          <div className="max-w-2xl mx-auto">
              {!question ? (
                  <div className="space-y-4">
                      <h2 className="text-lg font-semibold">Select a Question</h2>
                      <AutocompleteInput onSelect={handleQuestionSelect} />
                  </div>
              ) : (
                  <div className="space-y-4">
                      <div className="bg-white rounded-lg p-6 shadow">
                          <h3 className="text-lg font-semibold mb-4">{question}</h3>

                              {!isAnswerRevealed ? (
                                  <div className="space-y-4">
                                      <div className="relative">
                                          <span className="absolute left-3 top-2 text-gray-600">What is...</span>
                                          <input
                                              type="text"
                                              value={userAnswer}
                                              onChange={(e) => setUserAnswer(e.target.value)}
                                              className="w-full p-2 pl-24 border rounded text-black"
                                              placeholder="your answer..."
                                          />
                                      </div>
                                      <div className="flex justify-between">
                                          <button
                                              onClick={handleAnswerSubmit}
                                              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                          >
                                              Submit
                                          </button>
                                          <button
                                              onClick={handleShowAnswer}
                                              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                          >
                                              Show Answer
                                          </button>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="space-y-4">
                                      <div className={`p-4 rounded-lg ${showingAnswer ? 'bg-gray-100' :
                                              isCorrect ? 'bg-green-100' : 'bg-red-100'
                                          }`}>
                                          <div className="flex items-center gap-2">
                                              {!showingAnswer && isCorrect === true && (
                                                  <span className="text-green-600 text-xl">✓</span>
                                                  )}
                                                  {!showingAnswer && isCorrect === false && (
                                                      <span className="text-red-600 text-xl">✗</span>
                                                  )}
                                                  <p className="font-medium text-black">
                                                      Correct answer: {answer}
                                                  </p>
                                              </div>
                                          </div>
                                          <button
                                          onClick={handleNextQuestion}
                                          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                      >
                                          Next Question
                                      </button>
                                  </div>
                              )}
                          </div>
                      </div>
              )}
          </div>
      </div>
  )
} 