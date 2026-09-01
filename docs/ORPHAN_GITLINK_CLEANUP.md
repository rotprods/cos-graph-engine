# Orphan gitlink cleanup

The root tree contains `cos-graph-engine-026bb43d-eec2-4a08-872e-020acdbf97cf` as mode `160000` / type `commit`, but the repository has no matching `.gitmodules` entry. This causes checkout post-job warnings and must be removed via a Git tree commit rather than the Contents API (which correctly reports that the path is not a normal file).
