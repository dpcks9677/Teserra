using System.Collections.Generic;
using UnityEngine;

namespace Tessera.Dice
{
    public static class DiceMeshFactory
    {
        private const int Segments = 4;
        private const int TotalSegments = Segments * 2 + 1;

        private enum Face
        {
            Right,
            Left,
            Top,
            Bottom,
            Front,
            Back
        }

        public static Mesh Create(float size = 1.62f, float radius = 0.22f)
        {
            radius = Mathf.Min(size * 0.5f, radius);
            var vertices = new List<Vector3>(6 * (TotalSegments + 1) * (TotalSegments + 1));
            var normals = new List<Vector3>(vertices.Capacity);
            var uvs = new List<Vector2>(vertices.Capacity);
            var faceTriangles = new List<int>[6];
            for (int index = 0; index < faceTriangles.Length; index++)
            {
                faceTriangles[index] = new List<int>(TotalSegments * TotalSegments * 6);
            }
            float half = size * 0.5f - radius;
            float halfSegmentSize = 0.5f / TotalSegments;

            AddFace(Face.Right, half, radius, vertices, normals, uvs, faceTriangles[0], halfSegmentSize);
            AddFace(Face.Left, half, radius, vertices, normals, uvs, faceTriangles[1], halfSegmentSize);
            AddFace(Face.Top, half, radius, vertices, normals, uvs, faceTriangles[2], halfSegmentSize);
            AddFace(Face.Bottom, half, radius, vertices, normals, uvs, faceTriangles[3], halfSegmentSize);
            AddFace(Face.Front, half, radius, vertices, normals, uvs, faceTriangles[4], halfSegmentSize);
            AddFace(Face.Back, half, radius, vertices, normals, uvs, faceTriangles[5], halfSegmentSize);

            var mesh = new Mesh { name = "WebRoundedBox_D6" };
            mesh.SetVertices(vertices);
            mesh.SetNormals(normals);
            mesh.SetUVs(0, uvs);
            mesh.subMeshCount = faceTriangles.Length;
            for (int index = 0; index < faceTriangles.Length; index++)
            {
                mesh.SetTriangles(faceTriangles[index], index, false);
            }
            mesh.RecalculateBounds();
            return mesh;
        }

        private static void AddFace(
            Face face,
            float half,
            float radius,
            List<Vector3> vertices,
            List<Vector3> normals,
            List<Vector2> uvs,
            List<int> triangles,
            float halfSegmentSize)
        {
            int start = vertices.Count;
            for (int row = 0; row <= TotalSegments; row++)
            {
                float v = -0.5f + row / (float)TotalSegments;
                for (int column = 0; column <= TotalSegments; column++)
                {
                    float u = -0.5f + column / (float)TotalSegments;
                    Vector3 position = FacePosition(face, u, v);
                    Vector3 normal = position;
                    normal.x -= Mathf.Sign(normal.x) * halfSegmentSize;
                    normal.y -= Mathf.Sign(normal.y) * halfSegmentSize;
                    normal.z -= Mathf.Sign(normal.z) * halfSegmentSize;
                    normal.Normalize();

                    vertices.Add(new Vector3(
                        half * Mathf.Sign(position.x) + normal.x * radius,
                        half * Mathf.Sign(position.y) + normal.y * radius,
                        half * Mathf.Sign(position.z) + normal.z * radius));
                    normals.Add(normal);
                    uvs.Add(new Vector2(column / (float)TotalSegments, row / (float)TotalSegments));
                }
            }

            int rowSize = TotalSegments + 1;
            for (int row = 0; row < TotalSegments; row++)
            {
                for (int column = 0; column < TotalSegments; column++)
                {
                    int i0 = start + row * rowSize + column;
                    int i1 = i0 + 1;
                    int i3 = i0 + rowSize;
                    int i2 = i3 + 1;
                    triangles.Add(i0);
                    triangles.Add(i1);
                    triangles.Add(i2);
                    triangles.Add(i0);
                    triangles.Add(i2);
                    triangles.Add(i3);
                }
            }
        }

        private static Vector3 FacePosition(Face face, float u, float v)
        {
            return face switch
            {
                Face.Right => new Vector3(0.5f, v, -u),
                Face.Left => new Vector3(-0.5f, v, u),
                Face.Top => new Vector3(u, 0.5f, -v),
                Face.Bottom => new Vector3(u, -0.5f, v),
                Face.Front => new Vector3(u, v, 0.5f),
                Face.Back => new Vector3(-u, v, -0.5f),
                _ => Vector3.zero
            };
        }
    }
}
