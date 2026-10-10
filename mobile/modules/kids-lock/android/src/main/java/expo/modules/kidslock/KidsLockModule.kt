package expo.modules.kidslock

import android.app.ActivityManager
import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Needed only when a parent provisions the phone as a dedicated device (device owner). */
class KidsLockAdminReceiver : DeviceAdminReceiver()

/**
 * Keeps Kids Islam on screen using Android lock task mode.
 * - Device owner: the app is allow-listed and locked silently; only the app's parent PIN can release it.
 * - Otherwise: Android screen pinning, which the person confirms; leaving needs the phone's own
 *   unlock PIN when "Ask for PIN before unpinning" is on.
 */
class KidsLockModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun policy(): DevicePolicyManager =
    context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

  private fun isOwner(): Boolean = policy().isDeviceOwnerApp(context.packageName)

  override fun definition() = ModuleDefinition {
    Name("KidsLock")

    Function("getState") {
      val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      when (manager.lockTaskModeState) {
        ActivityManager.LOCK_TASK_MODE_LOCKED -> "locked"
        ActivityManager.LOCK_TASK_MODE_PINNED -> "pinned"
        else -> "none"
      }
    }

    Function("isDeviceOwner") { isOwner() }

    AsyncFunction("start") {
      val activity = appContext.throwingActivity
      if (isOwner()) {
        val admin = ComponentName(context, KidsLockAdminReceiver::class.java)
        policy().setLockTaskPackages(admin, arrayOf(context.packageName))
      }
      activity.startLockTask()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") {
      appContext.throwingActivity.stopLockTask()
    }.runOnQueue(Queues.MAIN)

    // Gives up dedicated-device mode so the app can be uninstalled normally again.
    AsyncFunction("releaseDeviceOwner") {
      appContext.throwingActivity.stopLockTask()
      if (isOwner()) {
        @Suppress("DEPRECATION")
        policy().clearDeviceOwnerApp(context.packageName)
      }
    }.runOnQueue(Queues.MAIN)
  }
}
