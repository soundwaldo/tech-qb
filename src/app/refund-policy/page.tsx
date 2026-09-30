import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";

export default function RefundPolicy() {
  return (
    <>
      <Header />

      <section className="bg-slate-900 text-white py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h1 className="text-4xl font-bold text-cyan-400 mb-2">Refund Policy</h1>
          <p className="text-slate-400 mb-8">We stand behind every assessment. If we can&apos;t deliver, you get your money back.</p>

          {/* When You&apos;re Eligible */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 flex-shrink-0" />
              <h2 className="text-2xl font-bold">When You Get a Full Refund</h2>
            </div>
            <div className="bg-emerald-900/20 border border-emerald-400/30 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-emerald-300 mb-2">Insufficient Photo Quality</h3>
                <p className="text-slate-300 text-sm">Photos are blurry, too dark, or don&apos;t show the necessary angles (door front, springs, tracks, any damage).</p>
              </div>
              <div>
                <h3 className="font-semibold text-emerald-300 mb-2">Incomplete Photo Set</h3>
                <p className="text-slate-300 text-sm">Critical angles are missing or key components cannot be assessed from the images provided.</p>
              </div>
              <div>
                <h3 className="font-semibold text-emerald-300 mb-2">Technical Issue on Our End</h3>
                <p className="text-slate-300 text-sm">If our system cannot complete the diagnosis due to a technical error, you receive a full refund.</p>
              </div>
            </div>
          </div>

          {/* When You Don&apos;t Get a Refund */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
              <h2 className="text-2xl font-bold">When Refunds Don&apos;t Apply</h2>
            </div>
            <div className="bg-red-900/20 border border-red-400/30 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-red-300 mb-2">Diagnosis Delivered</h3>
                <p className="text-slate-300 text-sm">You received a complete assessment, even if you disagree with the findings or decide not to pursue repairs.</p>
              </div>
              <div>
                <h3 className="font-semibold text-red-300 mb-2">Subsequent Photo Uploads</h3>
                <p className="text-slate-300 text-sm">If you request a revised assessment after receiving your initial report, that&apos;s a new transaction.</p>
              </div>
              <div>
                <h3 className="font-semibold text-red-300 mb-2">User-Initiated Cancellation</h3>
                <p className="text-slate-300 text-sm">If you cancel after submission but before our experts begin review, contact support for eligibility.</p>
              </div>
            </div>
          </div>

          {/* How to Request */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-cyan-400 flex-shrink-0" />
              <h2 className="text-2xl font-bold">How to Request a Refund</h2>
            </div>
            <div className="bg-cyan-900/20 border border-cyan-400/30 rounded-xl p-6">
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="font-bold text-cyan-400 flex-shrink-0">1.</span>
                  <div>
                    <p className="font-semibold text-slate-200">Email us within 14 days</p>
                    <p className="text-slate-400 text-sm">Contact support@ggaurdai.com with your assessment ID and the reason you believe you&apos;re eligible for a refund.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="font-bold text-cyan-400 flex-shrink-0">2.</span>
                  <div>
                    <p className="font-semibold text-slate-200">We review your case</p>
                    <p className="text-slate-400 text-sm">Our team will verify your claim within 2 business days and confirm refund eligibility.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="font-bold text-cyan-400 flex-shrink-0">3.</span>
                  <div>
                    <p className="font-semibold text-slate-200">Refund processed</p>
                    <p className="text-slate-400 text-sm">Approved refunds are issued within 5-7 business days to your original payment method.</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          {/* Photo Tips */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">Pro Tips: Get a Diagnosis on First Try</h2>
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-start gap-3">
                <span className="text-cyan-400 font-bold">•</span>
                <span><strong>Show the whole door:</strong> Take a straight-on photo from 6-10 feet away in daylight.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-cyan-400 font-bold">•</span>
                <span><strong>Capture the springs:</strong> Close-up of torsion springs at the top or side springs if visible.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-cyan-400 font-bold">•</span>
                <span><strong>Show damage:</strong> If there are dents, cracks, or rust, photograph them clearly.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-cyan-400 font-bold">•</span>
                <span><strong>Avoid shadows:</strong> Overcast days or well-lit garages work best.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-cyan-400 font-bold">•</span>
                <span><strong>Use your phone camera:</strong> Modern phones capture plenty of detail for diagnosis.</span>
              </li>
            </ul>
          </div>

          {/* Questions */}
          <div className="mt-10 text-center">
            <p className="text-slate-400 mb-4">Still have questions about refunds?</p>
            <a href="mailto:support@ggaurdai.com" className="text-cyan-400 hover:text-cyan-300 font-semibold">
              Contact our support team
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
