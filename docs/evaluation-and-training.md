# Evaluation and future training

The implemented personalization is household knowledge retrieval, not fine-tuning. Notes can be corrected independently of a model. Test Thread shows the supplied reference notes; helpful/correction feedback can be exported with questions, answers, provider mode, model, and source metadata.

Reviewed photo examples require explicit retention consent. Each has a label, intended task, source/group, creation time, and deterministic train/validation split. The same normalized group always uses the same split. Assign all views of the same physical object/session to one group, and inspect duplicate groups before training. A small collection may have no validation groups; this is not evidence of a ready training dataset.

Export from Look with me creates a ZIP with image files and manifest.json (dataset version 1). It does not upload anything or start a paid job. Keep reviewed consent records and remove identifiers/unneeded private information before any external training use. Family reminiscence photos are not automatically candidates for identity recognition.

Future experiment procedure:
1. Select a narrow task (for example, ordinary household-object description).
2. Review labels, consent, group boundaries, class balance and held-out coverage.
3. Freeze a dataset version and hold out complete households/object groups where possible.
4. Evaluate the base model with retrieval: answer correctness, source support, uncertainty, task success, unauthorized actions, latency and billed cost.
5. Only if a measurable gap remains, choose a currently supported training approach, estimate cost, obtain authorization for that dataset upload/job, and execute it separately.
6. Compare against the frozen baseline on held-out examples; investigate regressions before any rollout.

Current evidence is software testing with controlled provider fixtures. No live-model quality benchmark, fine-tuning run, clinical evaluation or suitability claim has been completed. Tests of rejected unknown tools demonstrate application enforcement, not proof that every prompt-injection attempt is defeated.
