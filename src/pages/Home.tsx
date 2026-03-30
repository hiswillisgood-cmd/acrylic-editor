import { useNavigate } from 'react-router-dom'
import { PRODUCT_LIST } from '@/config/products'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">아크릴 제품 웹에디터</h1>
      <p className="text-gray-500 mb-10">제작할 제품을 선택하세요</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl w-full">
        {PRODUCT_LIST.map((product) => (
          <button
            key={product.type}
            onClick={() => navigate(`/editor/${product.type}`)}
            className="group flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-sm border border-gray-200 hover:border-red-400 hover:shadow-lg transition-all cursor-pointer"
          >
            <span className="text-5xl group-hover:scale-110 transition-transform">
              {product.icon}
            </span>
            <div className="text-center">
              <h3 className="font-semibold text-gray-800 text-lg">{product.nameKo}</h3>
              <p className="text-sm text-gray-400 mt-1">{product.description}</p>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-12 text-xs text-gray-400">
        지원 형식: JPG, PNG | 최대 20MB
      </p>
    </div>
  )
}
