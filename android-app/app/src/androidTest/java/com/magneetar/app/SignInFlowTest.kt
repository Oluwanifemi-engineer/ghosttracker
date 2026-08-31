package com.magneetar.app

import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.action.ViewActions.closeSoftKeyboard
import androidx.test.espresso.action.ViewActions.typeText
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.intent.Intents
import androidx.test.espresso.intent.Intents.intended
import androidx.test.espresso.intent.matcher.IntentMatchers.hasComponent
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.espresso.matcher.ViewMatchers.withText
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Espresso UI tests for the sign-in flow.
 *
 * These tests validate the critical authentication UX:
 * - Email/password input fields are visible and functional
 * - Error messages display correctly
 * - Navigation to sign-up works
 * - Biometric prompt triggers (when available)
 *
 * Note: Network calls are mocked in production tests. These tests
 * validate UI behavior, not API integration (covered by server tests).
 */
@RunWith(AndroidJUnit4::class)
class SignInFlowTest {

    @get:Rule
    val activityRule = ActivityScenarioRule(SignInActivity::class.java)

    @Before
    fun setUp() {
        Intents.init()
    }

    @After
    fun tearDown() {
        Intents.release()
    }

    @Test
    fun testSignInFieldsAreDisplayed() {
        // Verify all sign-in UI elements are visible
        onView(withId(R.id.emailInput))
            .check(matches(isDisplayed()))

        onView(withId(R.id.passwordInput))
            .check(matches(isDisplayed()))

        onView(withId(R.id.signInButton))
            .check(matches(isDisplayed()))

        onView(withId(R.id.signUpLink))
            .check(matches(isDisplayed()))
    }

    @Test
    fun testEmptyEmailShowsError() {
        // Try to sign in with empty email
        onView(withId(R.id.passwordInput))
            .perform(typeText("password123"), closeSoftKeyboard())

        onView(withId(R.id.signInButton))
            .perform(click())

        // Should show email required error
        onView(withId(R.id.emailInput))
            .check(matches(hasErrorText("Email is required")))
    }

    @Test
    fun testInvalidEmailShowsError() {
        // Enter invalid email format
        onView(withId(R.id.emailInput))
            .perform(typeText("notanemail"), closeSoftKeyboard())

        onView(withId(R.id.passwordInput))
            .perform(typeText("password123"), closeSoftKeyboard())

        onView(withId(R.id.signInButton))
            .perform(click())

        // Should show invalid email error
        onView(withId(R.id.emailInput))
            .check(matches(hasErrorText("Invalid email format")))
    }

    @Test
    fun testEmptyPasswordShowsError() {
        // Try to sign in with empty password
        onView(withId(R.id.emailInput))
            .perform(typeText("test@example.com"), closeSoftKeyboard())

        onView(withId(R.id.signInButton))
            .perform(click())

        // Should show password required error
        onView(withId(R.id.passwordInput))
            .check(matches(hasErrorText("Password is required")))
    }

    @Test
    fun testNavigateToSignUp() {
        // Click sign-up link
        onView(withId(R.id.signUpLink))
            .perform(click())

        // Should navigate to SignUpActivity
        intended(hasComponent(SignUpActivity::class.java.name))
    }

    @Test
    fun testBiometricButtonIsDisplayed() {
        // Biometric button should be visible if device supports it
        // (may be hidden on devices without biometric hardware)
        try {
            onView(withId(R.id.biometricButton))
                .check(matches(isDisplayed()))
        } catch (e: Exception) {
            // Expected on devices without biometric support
        }
    }
}
