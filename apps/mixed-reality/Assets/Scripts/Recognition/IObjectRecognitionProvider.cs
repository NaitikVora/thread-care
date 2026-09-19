using System;
using RecallAR.Data;

namespace RecallAR.Recognition
{
    /// <summary>
    /// Fires when a familiar object has been found. See
    /// <see cref="IPersonRecognitionProvider"/> for why this is an interface:
    /// a future real object-detection provider swaps in behind it unchanged.
    /// </summary>
    public interface IObjectRecognitionProvider
    {
        event Action<RecallARObject> ObjectRecognized;
    }
}
