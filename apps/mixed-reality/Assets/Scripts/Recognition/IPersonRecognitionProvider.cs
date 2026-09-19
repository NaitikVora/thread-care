using System;
using RecallAR.Data;

namespace RecallAR.Recognition
{
    /// <summary>
    /// Fires when a familiar person has been recognized. Today,
    /// <see cref="SimulatedPersonRecognitionProvider"/> implements this with
    /// gaze-and-hold against known GameObjects. A future
    /// RealPersonRecognitionProvider could implement the same interface using
    /// Quest passthrough camera + an enrolled-profile match, and nothing
    /// downstream (UI, QuestManager) would need to change.
    /// </summary>
    public interface IPersonRecognitionProvider
    {
        event Action<RecognizablePerson> PersonRecognized;
    }
}
